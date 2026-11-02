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
const vendor = { id: '64f000000000000000000011', name: 'Nila Rahman', email: 'nila@example.com', phone: '01700123456', isActive: true, createdAt: '2026-05-01T00:00:00.000Z', shop: { id: '64f000000000000000000021', shopName: 'Nila Crafts', slug: 'nila-crafts', description: 'Handmade goods', contactEmail: 'shop@example.com', contactPhone: '01700999999', address: { line1: '12 Lake Road', city: 'Dhaka', district: 'Dhaka', country: 'Bangladesh' }, status: 'pending', isActive: true, createdAt: '2026-05-01T00:00:00.000Z' } };
const statistics = { totalVendors: 1, pendingApproval: 1, approvedVendors: 0, rejectedVendors: 0, activeShops: 1, inactiveShops: 0 };
const response = (data) => ({ data: { success: true, data } });

function renderApp(path = '/admin/vendors') {
  return render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AuthProvider><CartProvider><App /></CartProvider></AuthProvider></MemoryRouter>);
}

beforeEach(() => {
  window.sessionStorage.setItem('brazzars_access_token', 'admin-session');
  api.get.mockReset().mockImplementation(async (path) => {
    if (path === '/auth/me') return response({ user: admin });
    if (path.startsWith('/admin/vendors?')) return response({ vendors: [vendor], pagination: { page: 1, pages: 1, total: 1 }, statistics });
    if (path === `/admin/vendors/${vendor.id}`) return response({ vendor });
    return response({ vendors: [], pagination: { page: 1, pages: 0, total: 0 }, statistics });
  });
  api.post.mockReset();
  api.patch.mockReset();
});

afterEach(() => { vi.restoreAllMocks(); window.sessionStorage.clear(); });

describe('Admin vendor management', () => {
  it('shows database-backed vendor statistics and list records', async () => {
    renderApp();
    expect(await screen.findByRole('heading', { name: 'Vendor management' })).toBeTruthy();
    expect(await screen.findByText('Nila Rahman')).toBeTruthy();
    expect(screen.getByText('Nila Crafts')).toBeTruthy();
    expect(screen.getByText('Pending approval').parentElement.textContent).toContain('1');
    expect(screen.getByRole('link', { name: /review/i }).getAttribute('href')).toBe(`/admin/vendors/${vendor.id}`);
  });

  it('searches and filters vendors with pagination controls', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByText('Nila Crafts');
    await user.type(screen.getByLabelText('Search vendors'), 'Nila');
    await user.selectOptions(screen.getByLabelText('Approval status'), 'pending');
    await user.selectOptions(screen.getByLabelText('Registration date'), 'oldest');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(api.get.mock.calls.some(([path]) => path.includes('search=Nila') && path.includes('status=pending') && path.includes('sort=oldest'))).toBe(true));
  });

  it('shows vendor and shop details, then confirms and submits approval', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    api.patch.mockResolvedValueOnce(response({ vendor: { ...vendor, shop: { ...vendor.shop, status: 'approved', reviewedAt: '2026-06-01' } } }));
    renderApp(`/admin/vendors/${vendor.id}`);
    expect(await screen.findByRole('heading', { name: 'Vendor details' })).toBeTruthy();
    expect(screen.getByText('12 Lake Road')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Approve shop' }));
    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(`/admin/vendors/${vendor.id}/approve`, {}));
    expect(await screen.findByRole('status')).toBeTruthy();
  });

  it('requires a rejection reason and submits it to the Admin API', async () => {
    const user = userEvent.setup();
    api.patch.mockResolvedValueOnce(response({ vendor: { ...vendor, shop: { ...vendor.shop, status: 'rejected', rejectionReason: 'Missing details.' } } }));
    renderApp(`/admin/vendors/${vendor.id}`);
    await screen.findByRole('heading', { name: 'Vendor details' });
    await user.click(screen.getByRole('button', { name: 'Reject application' }));
    await user.type(screen.getByLabelText(/rejection reason/i), 'Missing details.');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reject vendor' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(`/admin/vendors/${vendor.id}/reject`, { reason: 'Missing details.' }));
  });

  it('confirms shop deactivation from details', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const approved = { ...vendor, shop: { ...vendor.shop, status: 'approved' } };
    api.get.mockImplementation(async (path) => path === '/auth/me' ? response({ user: admin }) : path === `/admin/vendors/${vendor.id}` ? response({ vendor: approved }) : response({}));
    api.patch.mockResolvedValueOnce(response({ vendor: { ...approved, shop: { ...approved.shop, isActive: false } } }));
    renderApp(`/admin/vendors/${vendor.id}`);
    await screen.findByRole('heading', { name: 'Vendor details' });
    await user.click(screen.getByRole('button', { name: 'Deactivate shop' }));
    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(`/admin/vendors/${vendor.id}/status`, { isActive: false }));
  });
});
