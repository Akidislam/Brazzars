import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CustomerLayout from '../components/marketplace/CustomerLayout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import api from '../services/api.js';

const money = (amount) => `৳${Number(amount).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const initialAddress = { line1: '', line2: '', city: '', district: '', postalCode: '', instructions: '' };
const IDEMPOTENCY_STORAGE_KEY = 'brazzars_checkout_idempotency';

function requestFingerprint(value) {
  const text = JSON.stringify(value);
  let first = 2166136261;
  let second = 0x9e3779b9;
  for (let index = 0; index < text.length; index += 1) {
    first = Math.imul(first ^ text.charCodeAt(index), 16777619);
    second = Math.imul(second ^ text.charCodeAt(index), 2246822519);
  }
  return `${(first >>> 0).toString(16)}${(second >>> 0).toString(16)}`;
}

export default function CheckoutPage() {
  const { user } = useAuth();
  const { items, subtotal, isReady, isLoading, loadError, clearProducts } = useCart();
  const navigate = useNavigate();
  const [form, setForm] = useState({ customerName: user?.name ?? '', phone: user?.phone ?? '', deliveryAddress: initialAddress });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const idempotencyRef = useRef(null);
  const available = items.filter((item) => item.status === 'available' && item.product);

  function update(field, value) { setForm((current) => ({ ...current, [field]: value })); }
  function updateAddress(field, value) { setForm((current) => ({ ...current, deliveryAddress: { ...current.deliveryAddress, [field]: value } })); }

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!items.length || available.length !== items.length || loadError) { setError('Please resolve unavailable cart items before placing your order.'); return; }
    const name = form.customerName.trim();
    const phone = form.phone.trim();
    if (!name || !phone || !form.deliveryAddress.line1.trim() || !form.deliveryAddress.city.trim() || !form.deliveryAddress.district.trim()) {
      setError('Enter your name, phone number, street address, city/area, and district.'); return;
    }
    const request = {
      customerName: name,
      phone,
      deliveryAddress: Object.fromEntries(Object.entries(form.deliveryAddress).map(([key, value]) => [key, value.trim()])),
      paymentMethod: 'COD',
      items: available.map((item) => ({ productId: item.productId ?? item.product.id, quantity: item.quantity })),
    };
    const fingerprint = requestFingerprint(request);
    if (!idempotencyRef.current) {
      try {
        const saved = JSON.parse(window.sessionStorage.getItem(IDEMPOTENCY_STORAGE_KEY) ?? 'null');
        if (saved?.fingerprint === fingerprint && typeof saved.key === 'string') idempotencyRef.current = saved;
      } catch { /* Treat unavailable session storage as a fresh checkout attempt. */ }
    }
    if (!idempotencyRef.current || idempotencyRef.current.fingerprint !== fingerprint) {
      idempotencyRef.current = { fingerprint, key: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}` };
      try { window.sessionStorage.setItem(IDEMPOTENCY_STORAGE_KEY, JSON.stringify(idempotencyRef.current)); } catch { /* The request remains protected while this page is open. */ }
    }
    setBusy(true);
    try {
      const response = await api.post('/orders', request, { headers: { 'Idempotency-Key': idempotencyRef.current.key } });
      const order = response?.data?.data?.order;
      if (!order?.id) throw new Error('Order response was incomplete. Please check My Orders before retrying.');
      clearProducts(request.items.map((item) => item.productId));
      try { window.sessionStorage.removeItem(IDEMPOTENCY_STORAGE_KEY); } catch { /* Safe to leave a completed request key in session storage. */ }
      navigate(`/orders/confirmation/${order.id}`, { replace: true, state: { order } });
    } catch (requestError) {
      setError(requestError.response?.data?.message ?? requestError.message ?? 'We could not place your order. Your cart is still saved. Please try again.');
    } finally { setBusy(false); }
  }

  return <CustomerLayout><main className="listing-page cart-page checkout-page">
    <div className="listing-heading"><p className="market-eyebrow">SECURE CHECKOUT</p><h1>Delivery details</h1><p>Pay in cash when your order arrives.</p></div>
    {!isReady || isLoading ? <div className="cart-loading" role="status">Checking your cart before checkout…</div> : items.length === 0 ? <section className="cart-empty"><h2>Your cart is empty</h2><p>Add some products before checking out.</p><Link className="button-primary" to="/search?q=">Continue shopping</Link></section> : <form className="checkout-layout" onSubmit={submit}>
      <section className="checkout-form-panel">
        {error && <div className="checkout-error" role="alert">{error}</div>}
        {loadError && <div className="checkout-error" role="alert">{loadError}</div>}
        {items.some((item) => item.status !== 'available') && <div className="checkout-error" role="alert">Some cart items are no longer available. Return to the cart to review them.</div>}
        <div className="checkout-section"><h2>Contact information</h2>
          <label>Full name<input autoComplete="name" maxLength="120" value={form.customerName} onChange={(event) => update('customerName', event.target.value)} required /></label>
          <label>Phone number<input autoComplete="tel" type="tel" maxLength="30" value={form.phone} onChange={(event) => update('phone', event.target.value)} required placeholder="01XXXXXXXXX" /></label>
        </div>
        <div className="checkout-section"><h2>Delivery address</h2>
          <label>Street address<input autoComplete="street-address" maxLength="180" value={form.deliveryAddress.line1} onChange={(event) => updateAddress('line1', event.target.value)} required placeholder="House, road, area" /></label>
          <label>Address details <span>(optional)</span><input maxLength="180" value={form.deliveryAddress.line2} onChange={(event) => updateAddress('line2', event.target.value)} placeholder="Apartment, floor, landmark" /></label>
          <div className="checkout-fields-row"><label>City / area<input autoComplete="address-level2" maxLength="100" value={form.deliveryAddress.city} onChange={(event) => updateAddress('city', event.target.value)} required /></label><label>District<input autoComplete="address-level1" maxLength="100" value={form.deliveryAddress.district} onChange={(event) => updateAddress('district', event.target.value)} required /></label></div>
          <label>Postal code <span>(optional)</span><input autoComplete="postal-code" maxLength="20" value={form.deliveryAddress.postalCode} onChange={(event) => updateAddress('postalCode', event.target.value)} /></label>
          <label>Delivery instructions <span>(optional)</span><textarea maxLength="500" rows="3" value={form.deliveryAddress.instructions} onChange={(event) => updateAddress('instructions', event.target.value)} placeholder="Anything the delivery team should know?" /></label>
        </div>
      </section>
      <aside className="cart-summary checkout-summary"><h2>Your order</h2>
        {available.map((item) => <div className="checkout-line" key={item.productId ?? item.slug}><span><strong>{item.product.name}</strong><small>{item.product.shop?.shopName ?? 'Brazzars shop'} · Qty {item.quantity}</small></span><strong>{money(Number(item.product.price) * item.quantity)}</strong></div>)}
        <div><span>Subtotal</span><span>{money(subtotal)}</span></div><div><span>Delivery</span><span>Not configured</span></div><div className="cart-summary-total"><strong>Total payable</strong><strong>{money(subtotal)}</strong></div>
        <div className="checkout-payment"><strong>Cash on Delivery</strong><span>Pay in cash when the order is delivered.</span></div>
        <button className="button-primary cart-checkout-button" type="submit" disabled={busy || available.length !== items.length || Boolean(loadError)}>{busy ? 'Placing order…' : 'Place order'}</button>
        <Link className="cart-continue-link" to="/cart">← Return to cart</Link>
      </aside>
    </form>}
  </main></CustomerLayout>;
}
