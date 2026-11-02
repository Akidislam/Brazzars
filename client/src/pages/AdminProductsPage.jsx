import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Clock3, Eye, Image as ImageIcon, LoaderCircle, PackageCheck, Search, ShieldCheck, Store, X } from 'lucide-react';
import AdminLayout from '../layouts/AdminLayout.jsx';
import api from '../services/api.js';

const EMPTY_STATS = { totalProducts: 0, pendingApproval: 0, approvedProducts: 0, rejectedProducts: 0, activeProducts: 0, inactiveProducts: 0 };
const formatDate = (value) => value ? new Date(value).toLocaleDateString('en-BD', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const money = (value) => `৳${Number(value ?? 0).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const statusLabel = (value) => ({ pending: 'Pending review', approved: 'Approved', rejected: 'Rejected', disabled: 'Disabled' }[value] ?? value ?? 'Unknown');

function ProductStatus({ status, active }) {
  return <div className="product-status-stack"><span className={`vendor-admin-status vendor-admin-${status ?? 'missing'}`}><i />{statusLabel(status)}</span><span className={`vendor-admin-activity ${active === false ? 'is-inactive' : 'is-active'}`}><i />{active === false ? 'Inactive' : 'Active'}</span></div>;
}

function Statistics({ statistics }) {
  const entries = [
    ['Total products', statistics.totalProducts, 'All marketplace products'],
    ['Pending approval', statistics.pendingApproval, 'Awaiting review'],
    ['Approved', statistics.approvedProducts, 'Cleared for listing'],
    ['Rejected', statistics.rejectedProducts, 'Not approved'],
    ['Active', statistics.activeProducts, 'Active flag enabled'],
    ['Inactive', statistics.inactiveProducts, 'Active flag disabled'],
  ];
  return <section className="vendor-admin-stat-grid" aria-label="Product statistics">{entries.map(([title, count, note]) => <article className="vendor-admin-stat" key={title}><span>{title}</span><strong>{count ?? 0}</strong><small>{note}</small></article>)}</section>;
}

function RejectDialog({ product, busy, onClose, onSubmit }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  function submit(event) {
    event.preventDefault();
    const normalized = reason.trim();
    if (normalized.length < 5 || normalized.length > 500) { setError('Enter a reason between 5 and 500 characters.'); return; }
    onSubmit(normalized);
  }
  return <div className="category-modal-backdrop" role="presentation"><section className="category-modal vendor-reject-modal" role="dialog" aria-modal="true" aria-labelledby="product-reject-title"><header><div><span className="category-modal-icon"><X size={18} /></span><div><p>PRODUCT REVIEW</p><h2 id="product-reject-title">Reject product?</h2></div></div><button type="button" aria-label="Close dialog" onClick={onClose} disabled={busy}><X size={18} /></button></header><form onSubmit={submit} noValidate><p className="vendor-reject-help">{product.name} will remain hidden from customers. Provide a reason for the vendor.</p><label htmlFor="product-rejection-reason">Rejection reason <span>*</span><textarea id="product-rejection-reason" autoFocus value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={4} required /><small>{reason.trim().length}/500 characters (minimum 5)</small></label>{error && <div className="category-form-error" role="alert">{error}</div>}<footer><button className="category-button category-button-quiet" type="button" onClick={onClose} disabled={busy}>Cancel</button><button className="category-button vendor-reject-button" type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Reject product'}</button></footer></form></section></div>;
}

export default function AdminProductsPage({ mode = 'list' }) {
  const { id } = useParams();
  const [products, setProducts] = useState([]);
  const [product, setProduct] = useState(null);
  const [categories, setCategories] = useState([]);
  const [statistics, setStatistics] = useState(EMPTY_STATS);
  const [pagination, setPagination] = useState({ page: 1, pages: 0, total: 0 });
  const [filters, setFilters] = useState({ page: 1, status: 'all', active: 'all', category: 'all', sort: 'newest' });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [rejecting, setRejecting] = useState(null);

  const listPath = useCallback(() => {
    const params = new URLSearchParams({ page: String(filters.page), limit: '10', sort: filters.sort });
    if (filters.status !== 'all') params.set('status', filters.status);
    if (filters.active !== 'all') params.set('active', filters.active);
    if (filters.category !== 'all') params.set('category', filters.category);
    if (search) params.set('search', search);
    return `/admin/products?${params}`;
  }, [filters, search]);

  const loadList = useCallback(async () => {
    const response = await api.get(listPath());
    const data = response?.data?.data ?? {};
    setProducts(data.products ?? []);
    setPagination(data.pagination ?? { page: 1, pages: 0, total: 0 });
    setStatistics(data.statistics ?? EMPTY_STATS);
  }, [listPath]);

  const loadDetail = useCallback(async () => {
    const response = await api.get(`/admin/products/${encodeURIComponent(id)}`);
    setProduct(response?.data?.data?.product ?? null);
  }, [id]);

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    const request = mode === 'detail' ? loadDetail() : loadList();
    request.catch((requestError) => { if (active) setError(requestError.response?.data?.message ?? `Could not load ${mode === 'detail' ? 'product details' : 'products'}. Please try again.`); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [mode, loadDetail, loadList]);

  useEffect(() => {
    if (mode !== 'list') return undefined;
    let active = true;
    api.get('/admin/categories?limit=100').then((response) => {
      if (active) setCategories(response?.data?.data?.categories ?? []);
    }).catch(() => { if (active) setCategories([]); });
    return () => { active = false; };
  }, [mode]);

  function changeFilter(key, value) { setFilters((current) => ({ ...current, [key]: value, page: 1 })); }
  function submitSearch(event) { event.preventDefault(); setSearch(searchInput.trim()); setFilters((current) => ({ ...current, page: 1 })); }

  async function review(target, action, body = {}) {
    if (!target) return;
    const label = action === 'approve' ? 'Approve' : 'Reject';
    if (action === 'approve' && !window.confirm(`Approve “${target.name}”? It can appear publicly when its shop is approved and active.`)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api.patch(`/admin/products/${encodeURIComponent(target.id)}/${action}`, body);
      setNotice(action === 'approve' ? 'Product approved.' : 'Product rejected. The vendor has a recorded review reason.');
      setRejecting(null);
      if (mode === 'detail') await loadDetail(); else await loadList();
    } catch (requestError) { setError(requestError.response?.data?.message ?? `${label} action failed.`); }
    finally { setBusy(false); }
  }

  async function toggleActive(target) {
    const nextActive = target.isActive === false;
    if (!window.confirm(`${nextActive ? 'Reactivate' : 'Disable'} “${target.name}”? ${nextActive ? 'It will still require an approved active shop to be publicly visible.' : 'Customers will no longer see this product.'}`)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api.patch(`/admin/products/${encodeURIComponent(target.id)}/status`, { isActive: nextActive });
      setNotice(`Product ${nextActive ? 'reactivated' : 'disabled'}.`);
      if (mode === 'detail') await loadDetail(); else await loadList();
    } catch (requestError) { setError(requestError.response?.data?.message ?? 'Product availability could not be updated.'); }
    finally { setBusy(false); }
  }

  return <AdminLayout><main className="admin-vendors-page admin-products-page">
    {mode === 'detail' ? <>
      <Link className="vendor-admin-back" to="/admin/products"><ArrowLeft size={16} /> Back to products</Link>
      <div className="admin-page-heading"><p>MARKETPLACE CATALOG</p><h1>Product details</h1><span>Review submitted product information and manage its approval and visibility.</span></div>
      {notice && <div className="admin-dashboard-notice" role="status">{notice}</div>}{error && <div className="category-page-error" role="alert">{error}<button type="button" onClick={() => { setLoading(true); loadDetail().catch((e) => setError(e.response?.data?.message ?? 'Could not load product details.')).finally(() => setLoading(false)); }}>Retry</button></div>}
      {loading ? <div className="category-state" role="status"><LoaderCircle size={19} className="spin" /> Loading product details…</div> : product && <>
        <section className="vendor-admin-detail-heading"><div className="product-detail-thumb">{product.images?.[0] ? <img src={product.images[0]} alt="" /> : <ImageIcon size={21} />}</div><div><p>PRODUCT SUBMISSION</p><h2>{product.name}</h2><span>Created {formatDate(product.createdAt)} · /{product.slug}</span></div><ProductStatus status={product.status} active={product.isActive} /></section>
        <div className="vendor-admin-detail-grid product-detail-grid"><section className="vendor-admin-detail-card"><header><PackageCheck size={17} /><h3>Product information</h3></header><div className="product-info-grid"><span>Price<strong>{money(product.price)}</strong></span><span>Compare at<strong>{product.compareAtPrice ? money(product.compareAtPrice) : '—'}</strong></span><span>Available stock<strong>{product.stock ?? 0}</strong></span><span>Category<strong>{product.category?.name ?? 'Uncategorized'}</strong></span></div><div className="vendor-admin-detail-divider" /><p className="product-description">{product.description}</p>{product.images?.length > 1 && <div className="product-detail-images">{product.images.map((src) => <img key={src} src={src} alt="Product image" />)}</div>}</section>
          <section className="vendor-admin-detail-card"><header><Store size={17} /><h3>Vendor and review</h3></header><p className="vendor-admin-shop-title">{product.shop?.shopName ?? 'Shop unavailable'}</p><p>{product.vendor?.name ?? 'Vendor'}{product.vendor?.email ? ` · ${product.vendor.email}` : ''}</p><p className="vendor-admin-shop-slug">{product.shop?.slug ? `/${product.shop.slug}` : ''}</p><div className="vendor-admin-detail-divider" /><div className="product-review-grid"><span>Review status<strong>{statusLabel(product.status)}</strong></span><span>Reviewed<strong>{formatDate(product.reviewedAt)}</strong></span><span>Shop status<strong>{product.shop?.status ?? 'Unknown'} · {product.shop?.isActive === false ? 'inactive' : 'active'}</strong></span></div>{product.rejectionReason && <div className="vendor-admin-reason"><strong>Rejection reason</strong><p>{product.rejectionReason}</p></div>}</section></div>
        <section className="vendor-admin-actions"><div><ShieldCheck size={17} /><span>Product administration</span></div>{product.deletedAt ? <span className="product-removed-note">Removed by vendor · product review and reactivation are unavailable</span> : <div className="vendor-admin-action-buttons">{product.status === 'pending' && <><button className="category-button category-button-primary" disabled={busy} onClick={() => review(product, 'approve')}><Check size={15} /> Approve</button><button className="category-button vendor-reject-button" disabled={busy} onClick={() => setRejecting(product)}>Reject</button></>}{product.status === 'approved' && <button className="category-button category-button-quiet" disabled={busy} onClick={() => toggleActive(product)}>{product.isActive === false ? 'Reactivate product' : 'Disable product'}</button>}</div>}</section>
      </>}
    </> : <>
      <div className="admin-page-heading"><p>MARKETPLACE CATALOG</p><h1>Product management</h1><span>Review vendor submissions and manage product availability across Brazzars.</span></div>
      {notice && <div className="admin-dashboard-notice" role="status">{notice}</div>}{error && <div className="category-page-error" role="alert">{error}<button type="button" onClick={() => { setLoading(true); loadList().catch((e) => setError(e.response?.data?.message ?? 'Could not load products.')).finally(() => setLoading(false)); }}>Retry</button></div>}
      {!loading && <Statistics statistics={statistics} />}
      <section className="vendor-admin-list-card"><header className="vendor-admin-list-heading"><div><h2><PackageCheck size={18} /> Marketplace products</h2><p>{pagination.total} products in this view</p></div><span><ShieldCheck size={14} /> Admin view</span></header>
        <div className="product-filters"><form className="vendor-admin-search" onSubmit={submitSearch}><Search size={15} /><input aria-label="Search products, vendors, or shops" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search product, vendor, shop" /><button type="submit">Search</button></form><label>Status<select aria-label="Filter by approval status" value={filters.status} onChange={(event) => changeFilter('status', event.target.value)}><option value="all">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="disabled">Disabled</option></select></label><label>Availability<select aria-label="Filter by active status" value={filters.active} onChange={(event) => changeFilter('active', event.target.value)}><option value="all">All availability</option><option value="true">Active</option><option value="false">Inactive</option></select></label><label>Category<select aria-label="Filter by category" value={filters.category} onChange={(event) => changeFilter('category', event.target.value)}><option value="all">All categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Order<select aria-label="Sort products" value={filters.sort} onChange={(event) => changeFilter('sort', event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label></div>
        {loading ? <div className="category-state" role="status"><LoaderCircle size={19} className="spin" /> Loading products…</div> : products.length === 0 ? <div className="category-state category-state-empty"><span><PackageCheck size={20} /></span><h3>No products found</h3><p>Try adjusting the search or filters.</p></div> : <div className="vendor-admin-table-scroll"><table className="vendor-admin-table product-admin-table"><thead><tr><th>Product</th><th>Vendor / shop</th><th>Category</th><th>Price / stock</th><th>Review / availability</th><th>Created</th><th>Actions</th></tr></thead><tbody>{products.map((item) => <tr key={item.id}><td><div className="product-table-cell"><span className="product-table-thumb">{item.images?.[0] ? <img src={item.images[0]} alt="" /> : <ImageIcon size={16} />}</span><span><strong>{item.name}</strong><small>/{item.slug}{item.deletedAt ? ' · removed by vendor' : ''}</small></span></div></td><td><span className="vendor-admin-shop-cell"><strong>{item.vendor?.name ?? 'Vendor'}</strong><small>{item.shop?.shopName ?? 'Shop unavailable'}</small></span></td><td>{item.category?.name ?? '—'}</td><td><span className="product-price-cell"><strong>{money(item.price)}</strong><small>{item.stock ?? 0} in stock</small></span></td><td><ProductStatus status={item.status} active={item.isActive} /></td><td><span className="vendor-admin-date"><Clock3 size={13} />{formatDate(item.createdAt)}</span></td><td><div className="product-row-actions"><Link className="category-icon-button" to={`/admin/products/${item.id}`} aria-label={`View ${item.name}`} title="View details"><Eye size={16} /></Link>{!item.deletedAt && item.status === 'pending' && <><button className="category-icon-button product-approve-icon" disabled={busy} onClick={() => review(item, 'approve')} aria-label={`Approve ${item.name}`} title="Approve"><Check size={16} /></button><button className="category-icon-button product-reject-icon" disabled={busy} onClick={() => setRejecting(item)} aria-label={`Reject ${item.name}`} title="Reject"><X size={16} /></button></>}{!item.deletedAt && item.status === 'approved' && <button className={`category-icon-button ${item.isActive === false ? 'category-activate' : 'category-deactivate'}`} disabled={busy} onClick={() => toggleActive(item)} aria-label={`${item.isActive === false ? 'Reactivate' : 'Disable'} ${item.name}`} title={item.isActive === false ? 'Reactivate' : 'Disable'}>{item.isActive === false ? <Check size={16} /> : <X size={16} />}</button>}</div></td></tr>)}</tbody></table></div>}
        {!loading && products.length > 0 && <footer className="vendor-admin-pagination"><span>Page {pagination.page} of {Math.max(1, pagination.pages)} · {pagination.total} total</span><div><button type="button" aria-label="Previous page" disabled={pagination.page <= 1} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}><ChevronLeft size={16} /></button><button type="button" aria-label="Next page" disabled={pagination.page >= pagination.pages} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}><ChevronRight size={16} /></button></div></footer>}
      </section>
    </>}
    {rejecting && <RejectDialog product={rejecting} busy={busy} onClose={() => setRejecting(null)} onSubmit={(reason) => review(rejecting, 'reject', { reason })} />}
  </main></AdminLayout>;
}
