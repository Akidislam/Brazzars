import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Clock3, LoaderCircle, Mail, MapPin, Phone, Search, ShieldCheck, Store, UserRound, X } from 'lucide-react';
import AdminLayout from '../layouts/AdminLayout.jsx';
import api from '../services/api.js';

const EMPTY_STATS = { totalVendors: 0, pendingApproval: 0, approvedVendors: 0, rejectedVendors: 0, activeShops: 0, inactiveShops: 0 };
const date = (value) => value ? new Date(value).toLocaleDateString('en-BD', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const label = (value) => ({ pending: 'Pending review', approved: 'Approved', rejected: 'Rejected', suspended: 'Suspended' }[value] ?? 'No shop');

function StatusBadge({ status }) {
  const kind = status ?? 'missing';
  return <span className={`vendor-admin-status vendor-admin-${kind}`}><i />{label(status)}</span>;
}

function StatisticCards({ statistics }) {
  const entries = [
    ['Total vendors', statistics.totalVendors, 'All vendor accounts'],
    ['Pending approval', statistics.pendingApproval, 'Awaiting review'],
    ['Approved', statistics.approvedVendors, 'Approved shops'],
    ['Rejected', statistics.rejectedVendors, 'Rejected shops'],
    ['Active shops', statistics.activeShops, 'Shop active flag'],
    ['Inactive shops', statistics.inactiveShops, 'Shop active flag off'],
  ];
  return <section className="vendor-admin-stat-grid" aria-label="Vendor statistics">{entries.map(([title, count, description]) => <article className="vendor-admin-stat" key={title}><span>{title}</span><strong>{count ?? 0}</strong><small>{description}</small></article>)}</section>;
}

function RejectDialog({ vendor, busy, onClose, onSubmit }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  function submit(event) {
    event.preventDefault();
    const normalized = reason.trim();
    if (normalized.length < 5 || normalized.length > 500) { setError('Enter a reason between 5 and 500 characters.'); return; }
    setError('');
    onSubmit(normalized);
  }
  return <div className="category-modal-backdrop" role="presentation"><section className="category-modal vendor-reject-modal" role="dialog" aria-modal="true" aria-labelledby="vendor-reject-title"><header><div><span className="category-modal-icon"><X size={18} /></span><div><p>VENDOR APPLICATION</p><h2 id="vendor-reject-title">Reject {vendor.name}?</h2></div></div><button type="button" aria-label="Close dialog" onClick={onClose} disabled={busy}><X size={18} /></button></header><form onSubmit={submit} noValidate><p className="vendor-reject-help">Add a clear reason for this decision. The vendor shop will remain hidden from customers.</p><label>Rejection reason <span>*</span><textarea autoFocus value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={4} placeholder="Explain what needs to be updated" required /><small>{reason.trim().length}/500 characters (minimum 5)</small></label>{error && <div className="category-form-error" role="alert">{error}</div>}<footer><button className="category-button category-button-quiet" type="button" onClick={onClose} disabled={busy}>Cancel</button><button className="category-button vendor-reject-button" type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Reject vendor'}</button></footer></form></section></div>;
}

function AddressView({ address }) {
  if (!address) return <p className="vendor-admin-muted">No shop address provided.</p>;
  const lines = [address.line1, address.line2, [address.city, address.district].filter(Boolean).join(', '), address.postalCode, address.country].filter(Boolean);
  return <p className="vendor-admin-address"><MapPin size={16} /> <span>{lines.map((line, index) => <span key={`${line}-${index}`}>{line}{index < lines.length - 1 && <br />}</span>)}</span></p>;
}

export default function AdminVendorsPage({ mode = 'list' }) {
  const { id } = useParams();
  const [vendors, setVendors] = useState([]);
  const [vendor, setVendor] = useState(null);
  const [statistics, setStatistics] = useState(EMPTY_STATS);
  const [pagination, setPagination] = useState({ page: 1, pages: 0, total: 0 });
  const [filters, setFilters] = useState({ page: 1, status: 'all', active: 'all', sort: 'newest' });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [rejecting, setRejecting] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    const request = mode === 'detail'
      ? api.get(`/admin/vendors/${encodeURIComponent(id)}`)
      : (() => {
        const params = new URLSearchParams({ page: String(filters.page), limit: '10', sort: filters.sort });
        if (filters.status !== 'all') params.set('status', filters.status);
        if (filters.active !== 'all') params.set('active', filters.active);
        if (search) params.set('search', search);
        return api.get(`/admin/vendors?${params}`);
      })();
    request.then((response) => {
      if (!active) return;
      if (mode === 'detail') setVendor(response?.data?.data?.vendor ?? null);
      else {
        setVendors(response?.data?.data?.vendors ?? []);
        setPagination(response?.data?.data?.pagination ?? { page: 1, pages: 0, total: 0 });
        setStatistics(response?.data?.data?.statistics ?? EMPTY_STATS);
      }
    }).catch((requestError) => {
      if (active) setError(requestError.response?.data?.message ?? (mode === 'detail' ? 'Could not load vendor details.' : 'Could not load vendors. Please try again.'));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [mode, id, filters, search]);

  async function reloadDetail() {
    try {
      const response = await api.get(`/admin/vendors/${encodeURIComponent(id)}`);
      setVendor(response?.data?.data?.vendor ?? null);
      setError('');
    } catch (requestError) { setError(requestError.response?.data?.message ?? 'The vendor could not be refreshed.'); }
  }

  async function updateStatus(target, action, body = {}) {
    if (!target) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await api.patch(`/admin/vendors/${encodeURIComponent(target.id)}/${action}`, body);
      const updated = response?.data?.data?.vendor;
      setNotice(action === 'approve' ? 'Vendor shop approved.' : action === 'reject' ? 'Vendor application rejected.' : `Shop ${body.isActive ? 'activated' : 'deactivated'}.`);
      if (mode === 'detail') setVendor(updated);
      else {
        const params = new URLSearchParams({ page: String(filters.page), limit: '10', sort: filters.sort });
        if (filters.status !== 'all') params.set('status', filters.status);
        if (filters.active !== 'all') params.set('active', filters.active);
        if (search) params.set('search', search);
        const listResponse = await api.get(`/admin/vendors?${params}`);
        setVendors(listResponse?.data?.data?.vendors ?? []);
        setPagination(listResponse?.data?.data?.pagination ?? { page: 1, pages: 0, total: 0 });
        setStatistics(listResponse?.data?.data?.statistics ?? EMPTY_STATS);
      }
      setRejecting(null);
    } catch (requestError) {
      setError(requestError.response?.data?.message ?? 'Vendor status could not be updated.');
      if (action === 'reject') setRejecting(null);
    }
    finally { setBusy(false); }
  }

  function confirmAction(target, action, body = {}) {
    const message = action === 'approve' ? `Approve ${target.shop?.shopName ?? target.name}? Their shop will be eligible for public listing if active.`
      : ` ${body.isActive ? 'Activate' : 'Deactivate'} ${target.shop?.shopName ?? target.name}?`;
    if (window.confirm(message.trim())) updateStatus(target, action, body);
  }

  function changeFilter(name, value) { setFilters((current) => ({ ...current, [name]: value, page: 1 })); }
  function submitSearch(event) { event.preventDefault(); setSearch(searchInput.trim()); setFilters((current) => ({ ...current, page: 1 })); }
  function retryList() { setFilters((current) => ({ ...current })); }

  return <AdminLayout><main className="admin-vendors-page">
    {mode === 'detail' ? <>
      <Link className="vendor-admin-back" to="/admin/vendors"><ArrowLeft size={16} /> Back to vendors</Link>
      <div className="admin-page-heading"><p>VENDOR REVIEW</p><h1>Vendor details</h1><span>Review shop application details and manage shop approval.</span></div>
      {notice && <div className="admin-dashboard-notice" role="status">{notice}</div>}{error && <div className="category-page-error" role="alert">{error}<button type="button" onClick={reloadDetail}>Retry</button></div>}
      {loading ? <div className="category-state" role="status"><LoaderCircle size={19} className="spin" /> Loading vendor details…</div> : vendor && <>
        <section className="vendor-admin-detail-heading"><div className="vendor-admin-avatar"><UserRound size={22} /></div><div><p>VENDOR ACCOUNT</p><h2>{vendor.name}</h2><span>Registered {date(vendor.createdAt)}</span></div><StatusBadge status={vendor.shop?.status} /></section>
        <div className="vendor-admin-detail-grid"><section className="vendor-admin-detail-card"><header><UserRound size={17} /><h3>Vendor information</h3></header><p><Mail size={15} /><a href={`mailto:${vendor.email}`}>{vendor.email}</a></p>{vendor.phone && <p><Phone size={15} /><a href={`tel:${vendor.phone}`}>{vendor.phone}</a></p>}<div className="vendor-admin-detail-divider" /><small>Account status: <strong>{vendor.isActive ? 'Active' : 'Inactive'}</strong></small></section>
          <section className="vendor-admin-detail-card"><header><Store size={17} /><h3>Shop information</h3></header>{vendor.shop ? <><p className="vendor-admin-shop-title">{vendor.shop.shopName}</p><p className="vendor-admin-shop-slug">/{vendor.shop.slug}</p>{vendor.shop.description && <p className="vendor-admin-description">{vendor.shop.description}</p>}<div className="vendor-admin-contact"><span><Mail size={14} />{vendor.shop.contactEmail || 'No contact email'}</span><span><Phone size={14} />{vendor.shop.contactPhone || 'No contact phone'}</span></div><AddressView address={vendor.shop.address} /><div className="vendor-admin-detail-divider" /><div className="vendor-admin-review-data"><span>Approval status <strong><StatusBadge status={vendor.shop.status} active={vendor.shop.isActive} /></strong></span><span>Shop status <strong>{vendor.shop.isActive ? 'Active' : 'Inactive'}</strong></span><span>Reviewed <strong>{date(vendor.shop.reviewedAt)}</strong></span></div>{vendor.shop.rejectionReason && <div className="vendor-admin-reason"><strong>Rejection reason</strong><p>{vendor.shop.rejectionReason}</p></div>}</> : <p className="vendor-admin-muted">No shop record is associated with this vendor.</p>}</section></div>
        {vendor.shop && <section className="vendor-admin-actions"><div><ShieldCheck size={17} /><span>Shop administration</span></div><div className="vendor-admin-action-buttons">{['pending', 'rejected'].includes(vendor.shop.status) && <button className="category-button category-button-primary" disabled={busy} onClick={() => confirmAction(vendor, 'approve')}><Check size={15} /> Approve shop</button>}{vendor.shop.status === 'pending' && <button className="category-button vendor-reject-button" disabled={busy} onClick={() => setRejecting(vendor)}>Reject application</button>}{vendor.shop.status === 'approved' && <button className="category-button category-button-quiet" disabled={busy} onClick={() => confirmAction(vendor, 'status', { isActive: !vendor.shop.isActive })}>{vendor.shop.isActive ? 'Deactivate shop' : 'Activate shop'}</button>}</div></section>}
      </>}
    </> : <>
      <div className="admin-page-heading"><p>MARKETPLACE PARTNERS</p><h1>Vendor management</h1><span>Review applications and manage shop availability across Brazzars.</span></div>
      {notice && <div className="admin-dashboard-notice" role="status">{notice}</div>}{error && <div className="category-page-error" role="alert">{error}<button type="button" onClick={retryList}>Retry</button></div>}
      {!loading && <StatisticCards statistics={statistics} />}
      <section className="vendor-admin-list-card"><header className="vendor-admin-list-heading"><div><h2><Store size={18} /> All vendors</h2><p>{pagination.total} vendor accounts</p></div><span><ShieldCheck size={14} /> Admin view</span></header>
        <form className="vendor-admin-filters" onSubmit={submitSearch}><label className="vendor-admin-search"><Search size={16} /><input aria-label="Search vendors" placeholder="Name, email, phone or shop" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /><button type="submit">Search</button></label><label>Approval status<select value={filters.status} onChange={(event) => changeFilter('status', event.target.value)}><option value="all">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="suspended">Suspended</option></select></label><label>Shop activity<select value={filters.active} onChange={(event) => changeFilter('active', event.target.value)}><option value="all">All shops</option><option value="true">Active</option><option value="false">Inactive</option></select></label><label>Registration date<select value={filters.sort} onChange={(event) => changeFilter('sort', event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label></form>
        {loading ? <div className="category-state" role="status"><LoaderCircle size={19} className="spin" /> Loading vendors…</div> : vendors.length === 0 ? <div className="category-state category-state-empty"><span><Store size={22} /></span><h3>No vendors found</h3><p>Try adjusting your search or filters.</p></div> : <div className="vendor-admin-table-scroll"><table className="vendor-admin-table"><thead><tr><th>Vendor</th><th>Shop</th><th>Registered</th><th>Approval</th><th>Shop activity</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{vendors.map((entry) => <tr key={entry.id}><td><Link className="vendor-admin-person" to={`/admin/vendors/${entry.id}`}><span className="vendor-admin-avatar-small">{entry.name?.slice(0, 1)?.toUpperCase() || 'V'}</span><span><strong>{entry.name}</strong><small>{entry.email}</small></span></Link></td><td>{entry.shop ? <span className="vendor-admin-shop-cell"><strong>{entry.shop.shopName}</strong><small>/{entry.shop.slug}</small></span> : <span className="vendor-admin-muted">No shop</span>}</td><td><span className="vendor-admin-date"><Clock3 size={14} />{date(entry.createdAt)}</span></td><td><StatusBadge status={entry.shop?.status} /></td><td>{entry.shop ? <span className={`vendor-admin-activity ${entry.shop.isActive ? 'is-active' : 'is-inactive'}`}><i />{entry.shop.isActive ? 'Active' : 'Inactive'}</span> : '—'}</td><td><Link className="vendor-admin-view-link" to={`/admin/vendors/${entry.id}`}>Review <ChevronRight size={15} /></Link></td></tr>)}</tbody></table></div>}
        {!loading && pagination.pages > 1 && <footer className="vendor-admin-pagination"><span>Page {pagination.page} of {pagination.pages}</span><div><button type="button" aria-label="Previous page" disabled={pagination.page <= 1} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}><ChevronLeft size={16} /></button><button type="button" aria-label="Next page" disabled={pagination.page >= pagination.pages} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}><ChevronRight size={16} /></button></div></footer>}
      </section>
    </>}
    {rejecting && <RejectDialog vendor={rejecting} busy={busy} onClose={() => setRejecting(null)} onSubmit={(reason) => updateStatus(rejecting, 'reject', { reason })} />}
  </main></AdminLayout>;
}
