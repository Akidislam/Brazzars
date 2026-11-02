import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, RefreshCw, ShoppingBag, Trash2 } from 'lucide-react';
import CustomerLayout from '../components/marketplace/CustomerLayout.jsx';
import { useCart } from '../context/CartContext.jsx';

function money(value) {
  return new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function groupByShop(items) {
  const groups = new Map();
  items.forEach((item) => {
    const shop = item.product?.shop;
    const key = shop?.slug ?? shop?.id ?? 'unavailable';
    if (!groups.has(key)) groups.set(key, { key, name: shop?.shopName ?? (key === 'unavailable' ? 'Unavailable item' : 'Marketplace shop'), items: [] });
    groups.get(key).items.push(item);
  });
  return [...groups.values()];
}

function CartItem({ item, onQuantity, onRemove }) {
  const [message, setMessage] = useState('');
  const product = item.product;
  const image = product?.images?.find((value) => typeof value === 'string' && value.trim());
  const itemKey = item.productId ?? item.slug;
  const available = item.status === 'available' && product;
  const subtotal = available ? Number(product.price) * item.quantity : null;

  function change(next) {
    setMessage('');
    try { onQuantity(itemKey, next); }
    catch (error) { setMessage(error.message); }
  }

  return <article className={`cart-item ${!available ? 'cart-item-unavailable' : ''}`}>
    <div className="cart-item-image">{image ? <img src={image} alt={product.name} /> : <ShoppingBag size={24} />}</div>
    <div className="cart-item-info">
      <strong>{product?.name ?? item.slug}</strong>
      <span>{product?.shop?.shopName ?? 'Shop details unavailable'}</span>
      {available && <small>{money(product.price)} each</small>}
      {item.status === 'checking' && <small role="status">Checking current availability…</small>}
      {available && item.reason && <small className="cart-stock-message" role="status">{item.reason}</small>}
      {item.status === 'unavailable' && <small className="cart-unavailable-message">{item.reason || 'This product is no longer available.'}</small>}
      {item.status === 'error' && <small className="cart-unavailable-message">Could not verify this product. Retry when connected.</small>}
      {message && <small className="cart-unavailable-message" role="alert">{message}</small>}
    </div>
    <div className="cart-quantity-control" aria-label={`Quantity for ${product?.name ?? item.slug}`}>
      <button type="button" aria-label={`Decrease ${product?.name ?? item.slug} quantity`} disabled={!available || item.quantity <= 1} onClick={() => change(item.quantity - 1)}><Minus size={15} /></button>
      <span aria-live="polite">{item.quantity}</span>
      <button type="button" aria-label={`Increase ${product?.name ?? item.slug} quantity`} disabled={!available || item.quantity >= Number(product?.stock)} onClick={() => change(item.quantity + 1)}><Plus size={15} /></button>
    </div>
    <strong className="cart-item-subtotal">{subtotal === null ? '—' : money(subtotal)}</strong>
    <button className="cart-remove-button" type="button" aria-label={`Remove ${product?.name ?? item.slug}`} onClick={() => onRemove(itemKey)}><Trash2 size={17} /></button>
  </article>;
}

export default function CartPage() {
  const { items, itemCount, subtotal, isReady, isLoading, loadError, setQuantity, removeProduct, refreshCart } = useCart();
  const navigate = useNavigate();
  const didRefreshOnEntry = useRef(false);
  const groups = groupByShop(items);
  const availableCount = items.filter((item) => item.status === 'available' && item.product).length;

  useEffect(() => {
    if (!didRefreshOnEntry.current && isReady && !isLoading && items.length > 0) {
      didRefreshOnEntry.current = true;
      void refreshCart();
    }
  }, [isReady, isLoading, items.length, refreshCart]);

  return <CustomerLayout><main className="listing-page cart-page">
    <div className="listing-heading"><p className="market-eyebrow">YOUR BRAZZARS CART</p><h1>Shopping cart <span className="cart-heading-count">{itemCount}</span></h1><p>Review your items and current availability before checkout.</p></div>
    {!isReady || isLoading ? <div className="cart-loading" role="status"><RefreshCw size={20} className="spin" />{!isReady ? 'Preparing your cart…' : 'Checking saved items against current product availability…'}</div> : <>
      {loadError && <div className="cart-load-error" role="alert"><span>{loadError}</span><button type="button" onClick={refreshCart}>Retry check</button></div>}
      {items.length === 0 ? <section className="cart-empty"><span className="cart-empty-icon"><ShoppingBag size={30} /></span><h2>Your cart is empty</h2><p>Browse the marketplace and add products you like.</p><Link className="button-primary" to="/search?q=">Continue shopping</Link></section> : <div className="cart-layout">
        <section className="cart-items-list" aria-label="Cart items">
          {groups.map((group) => <div className="cart-shop-group" key={group.key}>
            <h2>{group.name}</h2>
            {group.items.map((item) => <CartItem key={item.productId ?? item.slug} item={item} onQuantity={setQuantity} onRemove={removeProduct} />)}
          </div>)}
          <Link className="cart-continue-link" to="/search?q=">← Continue shopping</Link>
        </section>
        <aside className="cart-summary">
          <h2>Order summary</h2>
          <div><span>Items</span><span>{itemCount}</span></div>
          <div><strong>Subtotal</strong><strong>{money(subtotal)}</strong></div>
          <div className="cart-summary-total"><strong>Total</strong><strong>{money(subtotal)}</strong></div>
          <p>Delivery and any applicable charges are not included yet.</p>
          <button className="button-primary cart-checkout-button" type="button" disabled={availableCount === 0 || availableCount !== items.length || Boolean(loadError)} onClick={() => navigate('/checkout')}>Proceed to checkout</button>
          <small>Checkout is a placeholder for the next milestone.</small>
        </aside>
      </div>}
    </>}
  </main></CustomerLayout>;
}
