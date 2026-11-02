import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Image, LoaderCircle, Pencil, Plus, Search, Tags, ToggleLeft, ToggleRight, X } from 'lucide-react';
import AdminLayout from '../layouts/AdminLayout.jsx';
import api from '../services/api.js';

const EMPTY_FORM = { name: '', slug: '', description: '', image: '' };
function makeSlug(value) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'category';
}
function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-BD', { day: 'numeric', month: 'short', year: 'numeric' });
}

function CategoryForm({ category, onClose, onSave }) {
  const [form, setForm] = useState(category ? {
    name: category.name ?? '', slug: category.slug ?? '', description: category.description ?? '', image: category.image ?? '',
  } : EMPTY_FORM);
  const [autoSlug, setAutoSlug] = useState(!category);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  function update(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value, ...(name === 'name' && autoSlug ? { slug: makeSlug(value) } : {}) }));
  }
  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!form.name.trim()) { setError('Enter a category name.'); return; }
    if (form.name.trim().length > 120) { setError('Category names can be at most 120 characters.'); return; }
    if (form.description.length > 1000) { setError('Descriptions can be at most 1,000 characters.'); return; }
    if (form.image.trim()) {
      try { const parsed = new URL(form.image.trim()); if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(); }
      catch { setError('Enter a valid image URL beginning with http:// or https://.'); return; }
    }
    setBusy(true);
    try { await onSave({ ...form, name: form.name.trim(), slug: form.slug.trim(), description: form.description.trim(), image: form.image.trim() }); }
    catch (requestError) { setError(requestError.response?.data?.message ?? 'Category could not be saved. Please try again.'); }
    finally { setBusy(false); }
  }

  return <div className="category-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}><section className="category-modal" role="dialog" aria-modal="true" aria-labelledby="category-form-title"><header><div><span className="category-modal-icon"><Tags size={18} /></span><div><p>{category ? 'CATEGORY DETAILS' : 'NEW MARKETPLACE CATEGORY'}</p><h2 id="category-form-title">{category ? 'Edit category' : 'Create category'}</h2></div></div><button type="button" aria-label="Close dialog" onClick={onClose} disabled={busy}><X size={18} /></button></header><form onSubmit={submit} noValidate><label>Category name <span>*</span><input name="name" value={form.name} onChange={update} maxLength={120} autoFocus placeholder="e.g. Home & Living" required /></label><label>URL slug<input name="slug" value={form.slug} onChange={(event) => { setAutoSlug(false); update(event); }} maxLength={120} placeholder="home-living" /><small>{category ? 'Keep the current slug to preserve existing category links.' : 'Generated from the category name. You can edit it.'}</small></label><label>Description<textarea name="description" value={form.description} onChange={update} maxLength={1000} rows={3} placeholder="A short introduction for customers" /><small>{form.description.length}/1,000 characters</small></label><label>Image URL<input name="image" type="url" value={form.image} onChange={update} maxLength={2048} placeholder="https://example.com/category.jpg" /></label>{error && <div className="category-form-error" role="alert">{error}</div>}<footer><button type="button" className="category-button category-button-quiet" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" className="category-button category-button-primary" disabled={busy}>{busy ? 'Saving…' : category ? 'Save changes' : 'Create category'}</button></footer></form></section></div>;
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(undefined);
  const [busyId, setBusyId] = useState('');
  const activeCount = useMemo(() => categories.filter((category) => category.isActive).length, [categories]);

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    api.get(`/admin/categories${params.toString() ? `?${params}` : ''}`)
      .then((response) => { if (active) setCategories(response?.data?.data?.categories ?? []); })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message ?? 'Could not load categories. Check your connection and try again.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [search]);

  async function saveCategory(values) {
    if (editing) {
      await api.patch(`/admin/categories/${encodeURIComponent(editing.id)}`, values);
      setNotice('Category changes saved.');
    } else {
      await api.post('/admin/categories', values);
      setNotice('Category created successfully.');
    }
    setEditing(undefined);
    await reload();
  }

  async function reload() {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    try {
      const response = await api.get(`/admin/categories${params.toString() ? `?${params}` : ''}`);
      setCategories(response?.data?.data?.categories ?? []);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message ?? 'Category saved, but the list could not be refreshed.');
    }
  }

  async function toggleStatus(category) {
    const nextActive = !category.isActive;
    const action = nextActive ? 'activate' : 'deactivate';
    if (!window.confirm(`${action[0].toUpperCase()}${action.slice(1)} “${category.name}”? ${nextActive ? 'It will be visible to customers.' : 'It will be hidden from public category listings.'}`)) return;
    setBusyId(category.id); setError(''); setNotice('');
    try {
      const response = await api.patch(`/admin/categories/${encodeURIComponent(category.id)}/status`, { isActive: nextActive });
      const updated = response?.data?.data?.category;
      setCategories((current) => current.map((item) => item.id === category.id ? updated : item));
      setNotice(`Category ${nextActive ? 'activated' : 'deactivated'}.`);
    } catch (requestError) {
      setError(requestError.response?.data?.message ?? 'Category status could not be changed.');
    } finally { setBusyId(''); }
  }

  function submitSearch(event) { event.preventDefault(); setSearch(searchInput.trim()); }

  return <AdminLayout><main className="admin-categories-page"><div className="admin-page-heading"><p>MARKETPLACE CATALOG</p><h1>Category management</h1><span>Organize the categories customers use to discover products.</span></div>
    <section className="category-summary"><div className="category-summary-icon"><Tags size={19} /></div><div><strong>{categories.length}</strong><span>{search ? 'Matching categories' : 'Total categories'}</span></div><div className="category-summary-divider" /><div className="category-summary-active"><span className="category-active-dot" /><strong>{activeCount}</strong><span>Active and visible</span></div></section>
    {notice && <div className="admin-dashboard-notice" role="status">{notice}</div>}{error && <div className="category-page-error" role="alert">{error}<button type="button" onClick={reload}>Retry</button></div>}
    <section className="category-table-card"><header className="category-table-toolbar"><div><h2>All categories</h2><p>Manage names, artwork, and visibility for the customer marketplace.</p></div><button type="button" className="category-button category-button-primary" onClick={() => setEditing(null)}><Plus size={16} /> Create category</button></header><form className="category-search" onSubmit={submitSearch}><label><Search size={16} /><input aria-label="Search categories by name" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search categories by name" /></label><button type="submit" className="category-button category-button-quiet">Search</button></form>
      {loading ? <div className="category-state" role="status"><LoaderCircle size={19} className="spin" /> Loading categories…</div> : categories.length === 0 ? <div className="category-state category-state-empty"><span><Tags size={22} /></span><h3>{search ? 'No matching categories' : 'No categories yet'}</h3><p>{search ? 'Try a different category name.' : 'Create your first category to organize marketplace products.'}</p>{search ? <button className="category-button category-button-quiet" type="button" onClick={() => { setSearchInput(''); setSearch(''); }}>Clear search</button> : <button className="category-button category-button-primary" type="button" onClick={() => setEditing(null)}><Plus size={15} /> Create category</button>}</div> : <div className="category-table-scroll"><table className="category-table"><thead><tr><th>Category</th><th>Slug</th><th>Status</th><th>Created</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{categories.map((category) => <tr key={category.id}><td><div className="category-table-name"><span className="category-thumbnail">{category.image ? <img src={category.image} alt="" loading="lazy" /> : <Image size={17} />}</span><span><strong>{category.name}</strong><small>{category.description || 'No description'}</small></span></div></td><td><code>{category.slug}</code></td><td><span className={`category-status ${category.isActive ? 'category-status-active' : 'category-status-inactive'}`}><i />{category.isActive ? 'Active' : 'Inactive'}</span></td><td><span className="category-created"><CalendarDays size={14} />{formatDate(category.createdAt)}</span></td><td><div className="category-row-actions"><button type="button" className="category-icon-button" aria-label={`Edit ${category.name}`} title="Edit category" onClick={() => setEditing(category)}><Pencil size={15} /></button><button type="button" className={`category-icon-button ${category.isActive ? 'category-deactivate' : 'category-activate'}`} aria-label={`${category.isActive ? 'Deactivate' : 'Activate'} ${category.name}`} title={`${category.isActive ? 'Deactivate' : 'Activate'} category`} disabled={busyId === category.id} onClick={() => toggleStatus(category)}>{busyId === category.id ? <LoaderCircle size={16} className="spin" /> : category.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}</button></div></td></tr>)}</tbody></table></div>}
    </section>
    {editing !== undefined && <CategoryForm category={editing || undefined} onClose={() => setEditing(undefined)} onSave={saveCategory} />}
  </main></AdminLayout>;
}
