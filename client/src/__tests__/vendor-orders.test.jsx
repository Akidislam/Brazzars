import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import api from '../services/api.js';
import { AuthProvider } from '../context/AuthContext.jsx';
import { CartProvider } from '../context/CartContext.jsx';
import App from '../App.jsx';

vi.mock('../services/api.js', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));

const vendor = { id: 'vendor-1', name: 'Vendor One', email: 'vendor@example.test', role: 'vendor' };
let order;
const stats = { ALL: 7, PENDING: 1, CONFIRMED: 1, PROCESSING: 1, SHIPPED: 1, DELIVERED: 2, CANCELLED: 1 };
function response(data) { return { data: { success: true, data } }; }

function renderApp(path = '/vendor/dashboard') {
  return render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AuthProvider><CartProvider><App /></CartProvider></AuthProvider></MemoryRouter>);
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.sessionStorage.setItem('brazzars_access_token', 'vendor-token');
  order = {
    id: '64c000000000000000000001', orderNumber: 'BRZ-ORDER-V1', parentOrder: '64c000000000000000000002', parentOrderNumber: 'BRZ-ORDER',
    customerSnapshot: { name: 'Nila Rahman', phone: '01700123456' },
    deliveryAddress: { line1: '12 Lake Road', city: 'Dhaka', district: 'Dhaka', country: 'Bangladesh' },
    status: 'PENDING', paymentMethod: 'COD', paymentStatus: 'PENDING', subtotal: 200, commissionTotal: 20, vendorEarningsTotal: 180,
    items: [{ product: '64c000000000000000000003', productSnapshot: { name: 'Woven Basket', image: '' }, shopSnapshot: { name: 'Jute House' }, quantity: 2, unitPrice: 100, lineSubtotal: 200 }],
    statusHistory: [{ status: 'PENDING', changedAt: new Date().toISOString(), actorRole: 'customer' }], createdAt: new Date().toISOString(),
  };
  api.get.mockReset(); api.post.mockReset(); api.patch.mockReset();
  api.get.mockImplementation(async (path) => {
    if (path === '/auth/me') return response({ user: vendor });
    if (path === '/vendor/orders/statistics') return response({ statistics: stats });
    if (path.startsWith('/vendor/orders?')) return response({ orders: [order], pagination: { page: 1, pages: 1, total: 1 } });
    if (path.startsWith('/vendor/orders/')) return response({ order });
    return response({});
  });
  api.patch.mockImplementation(async (_path, body) => {
    order = { ...order, status: body.status, statusHistory: [...order.statusHistory, { status: body.status, changedAt: new Date().toISOString(), actorRole: 'vendor' }] };
    return response({ order });
  });
});

describe('vendor order management', () => {
  it('shows only the authenticated vendor order overview and order statistics', async () => {
    renderApp();
    expect(await screen.findByRole('heading', { name: 'Your seller dashboard' })).toBeTruthy();
    expect((await screen.findByText('Total orders')).parentElement.textContent).toContain('7');
    expect(screen.getByText('Delivered').parentElement.textContent).toContain('2');
    expect(await screen.findByText('BRZ-ORDER-V1')).toBeTruthy();
    expect(screen.getByText('Nila Rahman')).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/vendor/orders/statistics');
    expect(api.get.mock.calls.some(([path]) => path.includes('vendor=') || path.includes('vendorId='))).toBe(false);
  });

  it('loads vendor order details and submits a permitted status update without financial fields', async () => {
    const user = userEvent.setup();
    renderApp(`/vendor/orders/${order.id}`);
    expect(await screen.findByRole('heading', { name: 'BRZ-ORDER-V1' })).toBeTruthy();
    expect(screen.getByText('BRZ-ORDER')).toBeTruthy();
    expect(screen.getByText('Commission (10%)')).toBeTruthy();
    await user.selectOptions(screen.getByLabelText('Update status'), 'CONFIRMED');
    await user.click(screen.getByRole('button', { name: 'Save status' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(`/vendor/orders/${order.id}/status`, { status: 'CONFIRMED' }));
    expect(await screen.findByText('Order status updated to CONFIRMED.')).toBeTruthy();
    expect(api.patch.mock.calls[0][1]).toEqual({ status: 'CONFIRMED' });
  });
});
