import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ClipboardList, PackageCheck, RefreshCw, Search, ShieldCheck, Store } from 'lucide-react';
import CustomerLayout from '../components/marketplace/CustomerLayout.jsx';
import api from '../services/api.js';

const STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
const TRANSITIONS = { PENDING: ['CONFIRMED', 'CANCELLED'], CONFIRMED: ['PROCESSING', 'CANCELLED'], PROCESSING: ['SHIPPED'], SHIPPED: ['DELIVERED'], DELIVERED: [], CANCELLED: [] };
const money = (amount) => `৳${Number(amount ?? 0).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (value) => new Date(value).toLocaleString('en-BD', { dateStyle: 'medium', timeStyle: 'short' });

function StatusPill({ status }) { return <span className={`vendor-order-status status-${status?.toLowerCase()}`}>{status}</span>; }

function StatisticCards({ statistics }) {
  const cards = [
    ['ALL', 'Total orders'], ['PENDING', 'Pending'], ['CONFIRMED', 'Confirmed'], ['PROCESSING', 'Processing'],
    ['SHIPPED', 'Shipped'], ['DELIVERED', 'Delivered'], ['CANCELLED', 'Cancelled'],
  ];
  return <div className="admin-order-stats"><div className="admin-order-stat-grid">{cards.map(([key, label]) => <article className="vendor-stat-card" key={key}><span>{label}</span><strong>{statistics[key] ?? '—'}</strong></article>)}</div><article className="admin-order-value-card"><span>Total order value</span><strong>{money(statistics.totalOrderValue)}</strong><small>Sum of parent order totals across the marketplace.</small></article></div>;
}

function StatusControl({ vendorOrder, busy, onUpdate }) {
  const choices = TRANSITIONS[vendorOrder.status] ?? [];
  const [nextStatus, setNextStatus] = useState(choices[0] ?? '');
  useEffect(() => setNextStatus((TRANSITIONS[vendorOrder.status] ?? [])[0] ?? ''), [vendorOrder.status]);
  if (!choices.length) return <small className="vendor-status-terminal">This vendor order has reached a final status.</small>;
  function confirmUpdate() {
    if (window.confirm(`Change ${vendorOrder.orderNumber} from ${vendorOrder.status} to ${nextStatus}?`)) onUpdate(vendorOrder.id, nextStatus);
  }
  return <div className="vendor-status-control admin-status-control"><label htmlFor={`admin-status-${vendorOrder.id}`}>Admin status override</label><div><select id={`admin-status-${vendorOrder.id}`} value={nextStatus} onChange={(event) => setNextStatus(event.target.value)}>{choices.map((status) => <option key={status}>{status}</option>)}</select><button type="button" className="button-primary" disabled={busy || !nextStatus} onClick={confirmUpdate}>{busy === vendorOrder.id ? 'Saving…' : 'Confirm update'}</button></div><small>Workflow validation applies. Updates are recorded with your Admin account.</small></div>;
}

function VendorOrderDetails({ vendorOrder, busy, onUpdate }) {
  return <article className="admin-vendor-order"><div className="admin-vendor-order-head"><div><span className="market-eyebrow">VENDOR ORDER · {vendorOrder.vendor.name}</span><h3>{vendorOrder.orderNumber}</h3><p>Parent reference: {vendorOrder.parentOrderNumber} · {vendorOrder.shopSnapshots.map((shop) => shop.name).join(', ')}</p></div><StatusPill status={vendorOrder.status} /></div>
    <div className="admin-vendor-order-info"><div><h4>Vendor earnings snapshot</h4><p>Subtotal <strong>{money(vendorOrder.subtotal)}</strong></p><p>Commission (10%) <strong>{money(vendorOrder.commissionTotal)}</strong></p><p>Vendor earnings <strong>{money(vendorOrder.vendorEarningsTotal)}</strong></p></div><div className="admin-vendor-products"><h4>Products</h4>{vendorOrder.items.map((item) => <div className="admin-product-line" key={item.product}><span className="admin-product-name"><Store size={15} /><span><strong>{item.productSnapshot.name}</strong><small>{item.shopSnapshot.name} · {item.quantity} × {money(item.unitPrice)}</small></span></span><strong>{money(item.lineSubtotal)}</strong></div>)}</div></div>
    <div className="admin-child-history"><h4>Vendor-order status history</h4>{vendorOrder.statusHistory.map((entry, index) => <p key={`${entry.changedAt}-${index}`}><StatusPill status={entry.status} /><span>{date(entry.changedAt)} · {entry.actorRole}{entry.actor ? ` · ${entry.actor}` : ''}</span></p>)}</div>
    <StatusControl key={`${vendorOrder.id}-${vendorOrder.status}`} vendorOrder={vendorOrder} busy={busy} onUpdate={onUpdate} />
  </article>;
}

export default function AdminOrdersPage({ mode = 'list' }) {
  const { id } = useParams();
  const [statistics, setStatistics] = useState({});
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [order, setOrder] = useState(null);
  const [filters, setFilters] = useState({ page: 1, status: 'ALL', search: '', from: '', to: '', sort: 'newest' });
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    if (mode === 'detail') {
      api.get(`/admin/orders/${encodeURIComponent(id)}`)
        .then((response) => { if (active) setOrder(response?.data?.data?.order ?? null); })
        .catch((requestError) => { if (active) setError(requestError.response?.data?.message ?? 'Could not load this order.'); })
        .finally(() => { if (active) setLoading(false); });
    } else {
      const params = new URLSearchParams({ page: String(filters.page), limit: '10', status: filters.status, sort: filters.sort });
      for (const key of ['search', 'from', 'to']) if (filters[key]) params.set(key, filters[key]);
      Promise.all([api.get('/admin/orders/statistics'), api.get(`/admin/orders?${params}`)])
        .then(([statsResponse, listResponse]) => {
          if (!active) return;
          setStatistics(statsResponse?.data?.data?.statistics ?? {});
          setOrders(listResponse?.data?.data?.orders ?? []);
          setPagination(listResponse?.data?.data?.pagination ?? { page: 1, pages: 1, total: 0 });
        })
        .catch((requestError) => { if (active) setError(requestError.response?.data?.message ?? 'Could not load marketplace orders.'); })
        .finally(() => { if (active) setLoading(false); });
    }
    return () => { active = false; };
  }, [mode, id, filters, reload]);

  async function updateStatus(vendorOrderId, status) {
    setBusy(vendorOrderId); setError(''); setNotice('');
    try {
      const response = await api.patch(`/admin/orders/vendor-orders/${encodeURIComponent(vendorOrderId)}/status`, { status });
      setOrder(response?.data?.data?.order ?? null);
      setNotice(`Vendor order status updated to ${status}.`);
      setReload((value) => value + 1);
    } catch (requestError) {
      setError(requestError.response?.data?.message ?? 'Could not update this order status.');
    } finally { setBusy(''); }
  }

  function submitSearch(event) { event.preventDefault(); setFilters((current) => ({ ...current, search: searchInput.trim(), page: 1 })); }

  return <CustomerLayout><main className="listing-page admin-orders-page">
    {mode === 'detail' ? <>
      <Link className="back-link" to="/admin/orders"><ArrowLeft size={16} /> Back to all orders</Link>
      <div className="listing-heading"><p className="market-eyebrow">ADMIN ORDER REVIEW</p><h1>Order details</h1><p>Review the complete parent order and its vendor fulfillment records.</p></div>
      {notice && <div className="vendor-order-success" role="status">{notice}</div>}{error && <div className="checkout-error" role="alert">{error}</div>}
      {loading ? <div className="cart-loading" role="status"><RefreshCw size={19} className="spin" />Loading order details…</div> : order && <>
        <section className="admin-order-overview"><div><span className="market-eyebrow">PARENT ORDER REFERENCE</span><h2>{order.orderNumber}</h2><p>{date(order.createdAt)} · Customer {order.customer.name}</p></div><StatusPill status={order.status} /><div className="admin-order-total"><span>Total</span><strong>{money(order.total)}</strong></div></section>
        <div className="admin-order-info-grid"><section className="admin-info-card"><h3>Customer & delivery</h3><p><strong>{order.customer.name}</strong></p><p><a href={`tel:${order.customer.phone}`}>{order.customer.phone}</a></p><p>{order.deliveryAddress.line1}{order.deliveryAddress.line2 ? `, ${order.deliveryAddress.line2}` : ''}<br />{order.deliveryAddress.city}, {order.deliveryAddress.district}{order.deliveryAddress.postalCode ? ` ${order.deliveryAddress.postalCode}` : ''}<br />{order.deliveryAddress.country}</p>{order.deliveryAddress.instructions && <small>Instructions: {order.deliveryAddress.instructions}</small>}</section>
          <section className="admin-info-card admin-parent-financials"><h3>Parent order totals</h3><p><span>Subtotal</span><strong>{money(order.subtotal)}</strong></p><p><span>Delivery</span><strong>{money(order.deliveryFee)}</strong></p><p><span>Commission snapshot</span><strong>{money(order.commissionTotal)}</strong></p><p><span>Payment</span><strong>{order.paymentMethod} · {order.paymentStatus}</strong></p></section></div>
        <section className="admin-order-history"><h3>Parent order status history</h3>{order.statusHistory.map((entry, index) => <p key={`${entry.changedAt}-${index}`}><StatusPill status={entry.status} /><span>{date(entry.changedAt)} · {entry.actorRole}{entry.actor ? ` · ${entry.actor}` : ''}</span></p>)}</section>
        <section className="admin-vendor-orders"><div className="admin-section-heading"><h2>Vendor orders</h2><span>{order.vendorOrders.length} vendors</span></div>{order.vendorOrders.map((child) => <VendorOrderDetails key={child.id} vendorOrder={child} busy={busy} onUpdate={updateStatus} />)}</section>
      </>}
    </> : <>
      <div className="listing-heading"><p className="market-eyebrow">MARKETPLACE ADMIN</p><h1>Order management</h1><p>Monitor customer orders and vendor fulfillment across Brazzars.</p></div>
      {error && <div className="checkout-error" role="alert">{error}</div>}
      {!loading && !error && <StatisticCards statistics={statistics} />}
      <section className="admin-orders-panel"><div className="vendor-orders-panel-head"><div><h2><ClipboardList size={19} /> All marketplace orders</h2><p>{pagination.total} parent orders</p></div><span className="admin-access-badge"><ShieldCheck size={15} /> Admin view</span></div>
        <form className="admin-order-filters" onSubmit={submitSearch}><label className="vendor-order-search"><Search size={17} /><input aria-label="Search order, customer, vendor or shop" placeholder="Order, customer, vendor or shop" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /><button type="submit">Search</button></label>
          <label>Status<select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value, page: 1 }))}><option value="ALL">All statuses</option>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
          <label>From<input type="date" value={filters.from} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value, page: 1 }))} /></label>
          <label>To<input type="date" value={filters.to} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value, page: 1 }))} /></label>
          <label>Sort<select value={filters.sort} onChange={(event) => setFilters((current) => ({ ...current, sort: event.target.value, page: 1 }))}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label>
        </form>
        {loading ? <div className="cart-loading" role="status"><RefreshCw size={19} className="spin" />Loading marketplace orders…</div> : orders.length === 0 ? <div className="vendor-orders-empty"><PackageCheck size={25} /><h3>No orders found</h3><p>Try changing the search or filters.</p></div> : <div className="admin-order-list">{orders.map((entry) => <Link to={`/admin/orders/${entry.id}`} className="admin-order-row" key={entry.id}><div><strong>{entry.orderNumber}</strong><small>{date(entry.createdAt)}</small></div><div><strong>{entry.customer.name}</strong><small>{entry.customer.phone}</small></div><div><strong>{entry.vendorOrders.map((child) => child.vendor.name).join(', ') || '—'}</strong><small>{entry.vendorOrders.flatMap((child) => child.shopSnapshots.map((shop) => shop.name)).join(', ')}</small></div><strong>{entry.itemCount} items</strong><strong>{money(entry.total)}</strong><StatusPill status={entry.status} /></Link>)}</div>}
        {!loading && pagination.pages > 1 && <div className="vendor-pagination"><span>Page {pagination.page} of {pagination.pages}</span><div><button type="button" disabled={pagination.page <= 1} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}>Previous</button><button type="button" disabled={pagination.page >= pagination.pages} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>Next</button></div></div>}
      </section>
    </>}
  </main></CustomerLayout>;
}
