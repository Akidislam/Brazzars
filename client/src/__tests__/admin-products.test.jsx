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
const product = { id: '64f000000000000000000021', name: 'Cotton Tote', slug: 'cotton-tote', description: 'A locally made tote', price: 850, stock: 6, images: [], status: 'pending', isActive: true, createdAt: '2026-05-01T00:00:00.000Z', vendor: { name: 'Aminul' }, shop: { shopName: 'Dhaka Craft' }, category: { id: '64f000000000000000000011', name: 'Bags' } };
const response = (data) => ({ data: { success: true, data } });

function renderApp(path = '/admin/products') {
  return render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AuthProvider><CartProvider><App /></CartProvider></AuthProvider></MemoryRouter>);
}

beforeEach(() => {
  window.sessionStorage.setItem('brazzars_access_token', 'admin-session');
  api.get.mockReset().mockImplementation(async (path) => {
    if (path === '/auth/me') return response({ user: admin });
    if (path.startsWith('/admin/categories')) return response({ categories: [{ id: product.category.id, name: 'Bags' }] });
    if (path.startsWith('/admin/products?')) return response({ products: [product], pagination: { page: 1, pages: 1, total: 1 }, statistics: { totalProducts: 1, pendingApproval: 1, approvedProducts: 0, rejectedProducts: 0, activeProducts: 1, inactiveProducts: 0 } });
    if (path === `/admin/products/${product.id}`) return response({ product });
    return response({});
  });
  api.patch.mockReset().mockResolvedValue(response({ product }));
});

afterEach(() => { vi.restoreAllMocks(); window.sessionStorage.clear(); });

describe('Admin product management', () => {
  it('lists product details and database-backed statistics', async () => {
    renderApp();
    expect(await screen.findByRole('heading', { name: 'Product management' })).toBeTruthy();
    expect(await screen.findByText('Cotton Tote')).toBeTruthy();
    expect(screen.getByText('Pending approval')).toBeTruthy();
    expect(screen.getByText('Dhaka Craft')).toBeTruthy();
  });

  it('searches and filters products', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByText('Cotton Tote');
    await user.type(screen.getByLabelText('Search products, vendors, or shops'), 'aminul');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(api.get.mock.calls.some(([path]) => path.includes('search=aminul'))).toBe(true));
    await user.selectOptions(screen.getByLabelText('Filter by approval status'), 'pending');
    await waitFor(() => expect(api.get.mock.calls.some(([path]) => path.includes('status=pending'))).toBe(true));
  });

  it('requires a rejection reason and sends it to the existing review API', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByText('Cotton Tote');
    await user.click(screen.getByRole('button', { name: 'Reject Cotton Tote' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Reject product' }));
    expect(await within(dialog).findByRole('alert')).toBeTruthy();
    await user.type(within(dialog).getByLabelText(/Rejection reason/), 'Please replace the unclear product photo.');
    await user.click(within(dialog).getByRole('button', { name: 'Reject product' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(`/admin/products/${product.id}/reject`, { reason: 'Please replace the unclear product photo.' }));
  });

  it('approves a pending product after confirmation', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderApp();
    await screen.findByText('Cotton Tote');
    await user.click(screen.getByRole('button', { name: 'Approve Cotton Tote' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(`/admin/products/${product.id}/approve`, {}));
  });

  it('loads full product details on the detail route', async () => {
    renderApp(`/admin/products/${product.id}`);
    expect(await screen.findByRole('heading', { name: 'Product details' })).toBeTruthy();
    expect(await screen.findByText('A locally made tote')).toBeTruthy();
    expect(screen.getByText('Vendor and review')).toBeTruthy();
  });
});
