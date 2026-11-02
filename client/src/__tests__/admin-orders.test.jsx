import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import api from '../services/api.js';
import { AuthProvider } from '../context/AuthContext.jsx';
import { CartProvider } from '../context/CartContext.jsx';
import App from '../App.jsx';

vi.mock('../services/api.js', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));

const admin = { id: 'admin-1', name: 'Admin One', email: 'admin@example.test', role: 'admin' };
let order;
function response(data) { return { data: { success: true, data } }; }

function renderApp(path = '/admin/orders') {
  return render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AuthProvider><CartProvider><App /></CartProvider></AuthProvider></MemoryRouter>);
}

beforeEach(() => {
  window.localStorage.clear(); window.sessionStorage.clear();
  window.sessionStorage.setItem('brazzars_access_token', 'admin-token');
  order = {
    id: '64d000000000000000000001', orderNumber: 'BRZ-PARENT-1', customer: { id: 'customer-1', name: 'Nila Rahman', phone: '01700123456' },
    status: 'PENDING', paymentMethod: 'COD', paymentStatus: 'PENDING', itemCount: 2, subtotal: 200, deliveryFee: 0, total: 200,
    commissionTotal: 20, vendorEarningsTotal: 180, createdAt: new Date().toISOString(),
    deliveryAddress: { line1: '12 Lake Road', city: 'Dhaka', district: 'Dhaka', country: 'Bangladesh', instructions: 'Call first.' },
    items: [{ product: 'product-1', productSnapshot: { name: 'Woven Basket' }, shopSnapshot: { name: 'Jute House' }, quantity: 2, unitPrice: 100, lineSubtotal: 200, commissionRate: .1, commissionAmount: 20, vendorEarnings: 180 }],
    statusHistory: [{ status: 'PENDING', changedAt: new Date().toISOString(), actor: 'customer-1', actorRole: 'customer' }],
    vendorOrders: [{ id: '64d000000000000000000002', orderNumber: 'BRZ-PARENT-1-V1', parentOrder: '64d000000000000000000001', parentOrderNumber: 'BRZ-PARENT-1',
      vendor: { id: 'vendor-1', name: 'Vendor One' }, shopSnapshots: [{ shop: 'shop-1', name: 'Jute House', slug: 'jute-house' }], status: 'PENDING', itemCount: 2,
      subtotal: 200, commissionTotal: 20, vendorEarningsTotal: 180, customer: { id: 'customer-1', name: 'Nila Rahman', phone: '01700123456' }, deliveryAddress: { line1: '12 Lake Road', city: 'Dhaka', district: 'Dhaka', country: 'Bangladesh' },
      paymentMethod: 'COD', paymentStatus: 'PENDING', items: [{ product: 'product-1', productSnapshot: { name: 'Woven Basket' }, shopSnapshot: { name: 'Jute House' }, quantity: 2, unitPrice: 100, lineSubtotal: 200, commissionRate: .1, commissionAmount: 20, vendorEarnings: 180 }],
      statusHistory: [{ status: 'PENDING', changedAt: new Date().toISOString(), actor: 'customer-1', actorRole: 'customer' }], createdAt: new Date().toISOString() }],
  };
  api.get.mockReset(); api.post.mockReset(); api.patch.mockReset();
  api.get.mockImplementation(async (path) => {
    if (path === '/auth/me') return response({ user: admin });
    if (path === '/admin/orders/statistics') return response({ statistics: { ALL: 4, PENDING: 1, CONFIRMED: 0, PROCESSING: 1, SHIPPED: 0, DELIVERED: 1, CANCELLED: 1, totalOrderValue: 950 } });
    if (path.startsWith('/admin/orders?')) return response({ orders: [order], pagination: { page: 1, pages: 1, total: 1 } });
    if (path.startsWith('/admin/orders/')) return response({ order });
    return response({});
  });
  api.patch.mockImplementation(async (_path, body) => {
    const child = order.vendorOrders[0];
    child.status = body.status;
    child.statusHistory.push({ status: body.status, changedAt: new Date().toISOString(), actor: admin.id, actorRole: 'admin' });
    order.status = body.status;
    order.statusHistory.push({ status: body.status, changedAt: new Date().toISOString(), actor: admin.id, actorRole: 'admin' });
    return response({ order });
  });
});

afterEach(() => vi.restoreAllMocks());

describe('admin order management', () => {
  it('loads marketplace order statistics and global order rows', async () => {
    renderApp();
    expect(await screen.findByRole('heading', { name: 'Order management' })).toBeTruthy();
    expect((await screen.findByText('Total order value')).parentElement.textContent).toContain('৳950.00');
    expect(await screen.findByText('BRZ-PARENT-1')).toBeTruthy();
    expect(screen.getByText(/Vendor One/)).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/admin/orders/statistics');
  });

  it('submits search, date, status and sorting filters', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByText('BRZ-PARENT-1');
    await user.type(screen.getByLabelText('Search order, customer, vendor or shop'), 'Nila');
    await user.selectOptions(screen.getByLabelText('Status'), 'PENDING');
    await user.selectOptions(screen.getByLabelText('Sort'), 'oldest');
    await user.type(screen.getByLabelText('From'), '2026-10-01');
    await user.type(screen.getByLabelText('To'), '2026-11-30');
    await user.click(screen.getAllByRole('button', { name: 'Search' }).at(-1));
    await waitFor(() => expect(api.get.mock.calls.some(([path]) => path.includes('search=Nila') && path.includes('status=PENDING') && path.includes('sort=oldest') && path.includes('from=2026-10-01') && path.includes('to=2026-11-30'))).toBe(true));
  });

  it('shows full order details and requires confirmation before updating a vendor order', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderApp(`/admin/orders/${order.id}`);
    expect(await screen.findByRole('heading', { name: 'BRZ-PARENT-1' })).toBeTruthy();
    expect(screen.getByText('Nila Rahman')).toBeTruthy();
    expect(screen.getByText(/Call first/)).toBeTruthy();
    expect(screen.getByText('BRZ-PARENT-1-V1')).toBeTruthy();
    await user.selectOptions(screen.getByLabelText('Admin status override'), 'CONFIRMED');
    await user.click(screen.getByRole('button', { name: 'Confirm update' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(`/admin/orders/vendor-orders/${order.vendorOrders[0].id}/status`, { status: 'CONFIRMED' }));
    expect(window.confirm).toHaveBeenCalled();
    expect(await screen.findByText('Vendor order status updated to CONFIRMED.')).toBeTruthy();
  });
});
