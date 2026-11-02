import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import api from '../services/api.js';
import { AuthProvider } from '../context/AuthContext.jsx';
import { CartProvider } from '../context/CartContext.jsx';
import App from '../App.jsx';

vi.mock('../services/api.js', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));

const admin = { id: '64f000000000000000000003', name: 'Brazzars Admin', email: 'admin@example.com', role: 'admin', isActive: true, mustChangePassword: false };
const category = { id: '64f000000000000000000011', name: 'Home & Living', slug: 'home-living', description: 'Decor for home', image: '', isActive: true, createdAt: '2026-05-01T00:00:00.000Z' };
const response = (data) => ({ data: { success: true, data } });

function renderApp() {
  return render(<MemoryRouter initialEntries={['/admin/categories']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AuthProvider><CartProvider><App /></CartProvider></AuthProvider></MemoryRouter>);
}

beforeEach(() => {
  window.sessionStorage.setItem('brazzars_access_token', 'admin-session');
  api.get.mockReset().mockImplementation(async (path) => {
    if (path === '/auth/me') return response({ user: admin });
    if (path.startsWith('/admin/categories')) return response({ categories: [category] });
    return response({});
  });
  api.post.mockReset();
  api.patch.mockReset();
});

afterEach(() => { vi.restoreAllMocks(); window.sessionStorage.clear(); });

describe('Admin category management', () => {
  it('lists categories and creates one with a generated slug', async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValueOnce(response({ category: { ...category, id: '64f000000000000000000012', name: 'Kitchen & Dining', slug: 'kitchen-dining' } }));
    renderApp();
    expect(await screen.findByRole('heading', { name: 'Category management' })).toBeTruthy();
    expect(await screen.findByText('Home & Living')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /create category/i }));
    await user.type(screen.getByLabelText('Category name *'), 'Kitchen & Dining');
    expect(screen.getByPlaceholderText('home-living').value).toBe('kitchen-dining');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Create category' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/categories', expect.objectContaining({ name: 'Kitchen & Dining', slug: 'kitchen-dining' })));
    expect((await screen.findByText('Category created successfully.')).textContent).toContain('Category created successfully.');
  });

  it('edits a category while retaining its existing slug by default', async () => {
    const user = userEvent.setup();
    api.patch.mockResolvedValueOnce(response({ category: { ...category, name: 'Home Decor' } }));
    renderApp();
    await screen.findByText('Home & Living');
    await user.click(screen.getByRole('button', { name: 'Edit Home & Living' }));
    await user.clear(screen.getByLabelText('Category name *'));
    await user.type(screen.getByLabelText('Category name *'), 'Home Decor');
    expect(screen.getByPlaceholderText('home-living').value).toBe('home-living');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(`/admin/categories/${category.id}`, expect.objectContaining({ name: 'Home Decor', slug: 'home-living' })));
  });

  it('requires confirmation and calls the status endpoint before deactivation', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    api.patch.mockResolvedValueOnce(response({ category: { ...category, isActive: false } }));
    renderApp();
    await screen.findByText('Home & Living');
    await user.click(screen.getByRole('button', { name: 'Deactivate Home & Living' }));
    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(`/admin/categories/${category.id}/status`, { isActive: false }));
    expect(await screen.findByText('Inactive')).toBeTruthy();
  });

  it('searches categories by name', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByText('Home & Living');
    await user.type(screen.getByLabelText('Search categories by name'), 'living');
    await user.click(screen.getByRole('button', { name: 'Search', exact: true }));
    await waitFor(() => expect(api.get.mock.calls.some(([path]) => path === '/admin/categories?search=living')).toBe(true));
  });
});
