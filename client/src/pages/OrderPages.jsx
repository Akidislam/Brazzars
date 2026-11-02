import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { CheckCircle2, PackageCheck } from 'lucide-react';
import CustomerLayout from '../components/marketplace/CustomerLayout.jsx';
import api from '../services/api.js';

const money = (amount) => `৳${Number(amount ?? 0).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function OrderCard({ order, link = true }) {
  return <article className="order-card"><div className="order-card-heading"><div><span className="market-eyebrow">ORDER REFERENCE</span><h2>{order.orderNumber}</h2></div><span className="order-status">{order.status}</span></div>
    <p>{order.items?.length ?? 0} item lines · {new Date(order.createdAt).toLocaleDateString()}</p>
    <strong>{money(order.total)}</strong>
    {link && <Link to={`/account/orders/${order.id}`}>View order</Link>}
  </article>;
}

export default function OrderPages({ mode }) {
  const { id } = useParams();
  const location = useLocation();
  const [orders, setOrders] = useState([]);
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    const stateOrder = mode === 'confirmation' && location.state?.order?.id === id ? location.state.order : null;
    const request = mode === 'list' ? api.get('/orders') : (stateOrder ? Promise.resolve({ data: { data: { order: stateOrder } } }) : api.get(`/orders/${encodeURIComponent(id)}`));
    request.then((response) => {
      if (!active) return;
      if (mode === 'list') setOrders(response?.data?.data?.orders ?? []);
      else if (response) setOrder(response?.data?.data?.order ?? null);
    }).catch((requestError) => { if (active) setError(requestError.response?.data?.message ?? 'We could not load this order.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [mode, id, location.state]);

  if (mode === 'confirmation') {
    return <CustomerLayout><main className="listing-page order-page"><section className="order-confirmation"><span className="confirmation-icon"><CheckCircle2 size={34} /></span><p className="market-eyebrow">ORDER RECEIVED</p><h1>Thank you for your order.</h1>
      {loading ? <p>Loading your order details…</p> : error ? <p role="alert">{error} Your order may still be available under My Orders.</p> : order ? <><p>Your Cash on Delivery order <strong>{order.orderNumber}</strong> has been placed.</p><OrderCard order={order} link={false} /><p>Pay {money(order.total)} in cash when your order arrives.</p></> : <p>Your order has been submitted. You can find its status in My Orders.</p>}
      <div className="order-page-actions"><Link className="button-primary" to="/account/orders">My Orders</Link><Link className="cart-continue-link" to="/search?q=">Continue shopping</Link></div>
    </section></main></CustomerLayout>;
  }

  return <CustomerLayout><main className="listing-page order-page"><div className="listing-heading"><p className="market-eyebrow">YOUR BRAZZARS</p><h1>{mode === 'list' ? 'My Orders' : 'Order details'}</h1><p>Track your marketplace purchases and order information.</p></div>
    {loading ? <div className="cart-loading" role="status"><PackageCheck size={20} />Loading order information…</div> : error ? <div className="checkout-error" role="alert">{error}</div> : mode === 'list' ? orders.length ? <div className="order-list">{orders.map((entry) => <OrderCard key={entry.id} order={entry} />)}</div> : <section className="cart-empty"><h2>No orders yet</h2><p>Your completed checkouts will appear here.</p><Link className="button-primary" to="/search?q=">Browse marketplace</Link></section>
      : order ? <section className="order-detail"><OrderCard order={order} link={false} /><h2>Items</h2>{order.items.map((item) => <div className="order-detail-line" key={item.product}><span>{item.productSnapshot.name}<small>{item.shopSnapshot.name} · {item.quantity} × {money(item.unitPrice)}</small></span><strong>{money(item.lineSubtotal)}</strong></div>)}<h2>Delivery</h2><p>{order.customerSnapshot.name} · {order.customerSnapshot.phone}</p><p>{order.deliveryAddress.line1}{order.deliveryAddress.line2 ? `, ${order.deliveryAddress.line2}` : ''}, {order.deliveryAddress.city}, {order.deliveryAddress.district}</p><p>Payment: Cash on Delivery · Status: {order.status}</p><Link className="cart-continue-link" to="/account/orders">← My Orders</Link></section> : <div className="checkout-error">Order not found.</div>}
  </main></CustomerLayout>;
}
