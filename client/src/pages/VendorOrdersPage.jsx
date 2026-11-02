import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, ClipboardList, PackageCheck, RefreshCw, Search, Store } from 'lucide-react';
import CustomerLayout from '../components/marketplace/CustomerLayout.jsx';
import api from '../services/api.js';

const STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
const TRANSITIONS = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};
const money = (amount) => `৳${Number(amount ?? 0).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (value) => new Date(value).toLocaleString('en-BD', { dateStyle: 'medium', timeStyle: 'short' });

function StatusPill({ status }) { return <span className={`vendor-order-status status-${status?.toLowerCase()}`}>{status}</span>; }

function SummaryCards({ statistics }) {
  const cards = [
    ['ALL', 'Total orders'], ['PENDING', 'Pending'], ['CONFIRMED', 'Confirmed'], ['PROCESSING', 'Processing'],
    ['SHIPPED', 'Shipped'], ['DELIVERED', 'Delivered'], ['CANCELLED', 'Cancelled'],
  ];
  return <div className="vendor-order-stats">{cards.map(([key, label]) => <article className="vendor-stat-card" key={key}><span>{label}</span><strong>{statistics[key] ?? '—'}</strong></article>)}</div>;
}

function StatusControl({ order, busy, onUpdate }) {
  const available = TRANSITIONS[order.status] ?? [];
  const [nextStatus, setNextStatus] = useState(available[0] ?? '');
  useEffect(() => setNextStatus((TRANSITIONS[order.status] ?? [])[0] ?? ''), [order.status]);
  if (!available.length) return <p className="vendor-status-terminal">This order has reached a final status.</p>;
  return <div className="vendor-status-control"><label htmlFor="next-order-status">Update status</label><div><select id="next-order-status" value={nextStatus} onChange={(event) => setNextStatus(event.target.value)}>{available.map((status) => <option key={status} value={status}>{status}</option>)}</select><button className="button-primary" type="button" disabled={busy || !nextStatus} onClick={() => onUpdate(nextStatus)}>{busy ? 'Saving…' : 'Save status'}</button></div><small>Only the next permitted status can be selected.</small></div>;
}

export default function VendorOrdersPage({ mode = 'list' }) {
  const { id } = useParams();
  const location = useLocation();
  const [statistics, setStatistics] = useState({});
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [order, setOrder] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({ status: 'ALL', sort: 'newest', search: '', page: 1 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    if (mode === 'detail') {
      api.get(`/vendor/orders/${encodeURIComponent(id)}`)
        .then((response) => { if (active) setOrder(response?.data?.data?.order ?? null); })
        .catch((requestError) => { if (active) setError(requestError.response?.data?.message ?? 'Could not load this order.'); })
        .finally(() => { if (active) setLoading(false); });
    } else {
      const query = new URLSearchParams({ page: String(filters.page), limit: '10', status: filters.status, sort: filters.sort, ...(filters.search ? { search: filters.search } : {}) });
      Promise.all([api.get('/vendor/orders/statistics'), api.get(`/vendor/orders?${query}`)])
        .then(([statsResponse, listResponse]) => {
          if (!active) return;
          setStatistics(statsResponse?.data?.data?.statistics ?? {});
          setOrders(listResponse?.data?.data?.orders ?? []);
          setPagination(listResponse?.data?.data?.pagination ?? { page: 1, pages: 1, total: 0 });
        })
        .catch((requestError) => { if (active) setError(requestError.response?.data?.message ?? 'Could not load vendor orders.'); })
        .finally(() => { if (active) setLoading(false); });
    }
    return () => { active = false; };
  }, [mode, id, filters, reload]);

  async function updateStatus(nextStatus) {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await api.patch(`/vendor/orders/${encodeURIComponent(id)}/status`, { status: nextStatus });
      setOrder(response?.data?.data?.order ?? null);
      setNotice(`Order status updated to ${nextStatus}.`);
      setReload((value) => value + 1);
    } catch (requestError) {
      setError(requestError.response?.data?.message ?? 'Could not update order status. Refresh and try again.');
    } finally { setBusy(false); }
  }

  function submitSearch(event) { event.preventDefault(); setFilters((current) => ({ ...current, search: searchInput.trim(), page: 1 })); }

  return <CustomerLayout><main className="listing-page vendor-orders-page">
    {mode === 'detail' ? <>
      <Link className="back-link" to="/vendor/orders"><ArrowLeft size={16} /> Back to orders</Link>
      <div className="listing-heading"><p className="market-eyebrow">VENDOR ORDER</p><h1>Order details</h1><p>Review fulfillment information and update this order through its allowed status steps.</p></div>
      {loading ? <div className="cart-loading" role="status"><RefreshCw size={19} className="spin" />Loading order…</div> : error ? <div className="checkout-error" role="alert">{error}</div> : order && <section className="vendor-order-detail">
        {notice && <div className="vendor-order-success" role="status">{notice}</div>}
        <div className="vendor-order-detail-head"><div><span className="market-eyebrow">VENDOR ORDER REFERENCE</span><h2>{order.orderNumber}</h2><p>Parent order <strong>{order.parentOrderNumber}</strong> · {date(order.createdAt)}</p></div><StatusPill status={order.status} /></div>
        {error && <div className="checkout-error" role="alert">{error}</div>}
        <div className="vendor-detail-grid"><section><h3>Customer delivery</h3><p><strong>{order.customerSnapshot.name}</strong></p><p><a href={`tel:${order.customerSnapshot.phone}`}>{order.customerSnapshot.phone}</a></p><p>{order.deliveryAddress.line1}{order.deliveryAddress.line2 ? `, ${order.deliveryAddress.line2}` : ''}<br />{order.deliveryAddress.city}, {order.deliveryAddress.district}{order.deliveryAddress.postalCode ? ` ${order.deliveryAddress.postalCode}` : ''}<br />{order.deliveryAddress.country}</p>{order.deliveryAddress.instructions && <p className="vendor-instructions">Delivery instructions: {order.deliveryAddress.instructions}</p>}</section>
          <section className="vendor-order-financials"><h3>Order totals</h3><p><span>Subtotal</span><strong>{money(order.subtotal)}</strong></p><p><span>Commission (10%)</span><strong>{money(order.commissionTotal)}</strong></p><p className="vendor-earnings"><span>Vendor earnings</span><strong>{money(order.vendorEarningsTotal)}</strong></p><small>Estimated earnings only. No payout is recorded by this system.</small></section></div>
        <section className="vendor-order-products"><h3>Products</h3>{order.items.map((item) => <article key={item.product}><div className="vendor-product-snapshot">{item.productSnapshot.image ? <img src={item.productSnapshot.image} alt="" /> : <span><Store size={18} /></span>}<div><strong>{item.productSnapshot.name}</strong><small>{item.shopSnapshot.name}</small></div></div><div className="vendor-product-price"><span>{item.quantity} × {money(item.unitPrice)}</span><strong>{money(item.lineSubtotal)}</strong></div></article>)}</section>
        <section className="vendor-order-history"><h3>Status history</h3>{order.statusHistory?.length ? <ol>{order.statusHistory.map((entry, index) => <li key={`${entry.status}-${entry.changedAt}-${index}`}><StatusPill status={entry.status} /><span>{date(entry.changedAt)} · {entry.actorRole === 'vendor' ? 'Vendor update' : entry.actorRole === 'customer' ? 'Order placed' : 'System record'}</span></li>)}</ol> : <p>History for older orders is not available.</p>}</section>
        <StatusControl key={order.status} order={order} busy={busy} onUpdate={updateStatus} />
      </section>}
    </> : <>
      <div className="listing-heading"><p className="market-eyebrow">SELLER SPACE</p><h1>Your seller dashboard</h1><p>Orders overview · Track and fulfill orders placed with your approved Brazzars shop.</p></div>
      {location.state?.notice && <div className="auth-notice auth-notice-success" role="status">{location.state.notice}</div>}
      {location.state?.shopStatus === 'pending' && <p className="dashboard-pending">Shop status: <strong>Pending Admin approval</strong>. Your shop is not publicly listed yet.</p>}
      {error && <div className="checkout-error" role="alert">{error}</div>}
      {!loading && !error && <SummaryCards statistics={statistics} />}
      <section className="vendor-orders-panel"><div className="vendor-orders-panel-head"><div><h2><ClipboardList size={19} /> Orders</h2><p>{pagination.total} vendor orders</p></div><Link to="/vendor/dashboard"><PackageCheck size={16} /> Overview</Link></div>
        <form className="vendor-order-filters" onSubmit={submitSearch}><label className="vendor-order-search"><Search size={17} /><input aria-label="Search order reference" placeholder="Search order reference" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /><button type="submit">Search</button></label>
          <label>Status<select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value, page: 1 }))}><option value="ALL">All statuses</option>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
          <label>Sort<select value={filters.sort} onChange={(event) => setFilters((current) => ({ ...current, sort: event.target.value, page: 1 }))}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label>
        </form>
        {loading ? <div className="cart-loading" role="status"><RefreshCw size={19} className="spin" />Loading your orders…</div> : orders.length === 0 ? <div className="vendor-orders-empty"><PackageCheck size={24} /><h3>No orders found</h3><p>Orders for your approved shop will appear here.</p></div> : <div className="vendor-order-list">{orders.map((entry) => <Link className="vendor-order-row" to={`/vendor/orders/${entry.id}`} key={entry.id}><div className="vendor-order-reference"><span>{entry.orderNumber}</span><small>Parent {entry.parentOrderNumber}</small></div><div><strong>{entry.customerSnapshot.name}</strong><small>{date(entry.createdAt)}</small></div><div><strong>{entry.items.reduce((sum, item) => sum + item.quantity, 0)} items</strong><small>{entry.items.length} product lines</small></div><strong className="vendor-order-amount">{money(entry.subtotal)}</strong><StatusPill status={entry.status} /></Link>)}</div>}
        {!loading && pagination.pages > 1 && <div className="vendor-pagination"><span>Page {pagination.page} of {pagination.pages}</span><div><button type="button" disabled={pagination.page <= 1} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}>Previous</button><button type="button" disabled={pagination.page >= pagination.pages} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>Next</button></div></div>}
      </section>
    </>}
  </main></CustomerLayout>;
}
