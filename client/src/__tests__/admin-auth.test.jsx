import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import api from '../services/api.js';
import { AuthProvider } from '../context/AuthContext.jsx';
import { CartProvider } from '../context/CartContext.jsx';
import App from '../App.jsx';

vi.mock('../services/api.js', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const admin = { id: '64f000000000000000000003', name: 'Brazzars Admin', email: 'admin@gmail.com', role: 'admin', isActive: true, mustChangePassword: false };
const customer = { id: '64f000000000000000000001', name: 'Nila Rahman', email: 'nila@example.com', role: 'customer', isActive: true };

function response(user, token = 'admin-session') { return { data: { success: true, data: { user, token } } }; }
function renderApp(path) {
  return render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AuthProvider><CartProvider><App /></CartProvider></AuthProvider></MemoryRouter>);
}

beforeEach(() => {
  window.sessionStorage.clear();
  api.get.mockReset().mockResolvedValue({ data: { success: true, data: { user: null } } });
  api.post.mockReset();
});

describe('dedicated Admin authentication', () => {
  it('provides a separate Admin login and opens the Admin dashboard for database-backed admins', async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValueOnce(response(admin));
    renderApp('/admin/login');
    await user.type(await screen.findByLabelText('Email address'), 'admin@gmail.com');
    await user.type(screen.getByLabelText('Password'), 'a-safe-admin-password');
    await user.click(screen.getByRole('button', { name: /sign in to admin/i }));
    expect(await screen.findByRole('heading', { name: 'Dashboard overview' })).toBeTruthy();
    expect(api.post).toHaveBeenCalledWith('/auth/login', { email: 'admin@gmail.com', password: 'a-safe-admin-password' });
  });

  it('routes the first Admin login to mandatory password change', async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValueOnce(response({ ...admin, mustChangePassword: true }));
    renderApp('/admin/login');
    await user.type(await screen.findByLabelText('Email address'), 'admin@gmail.com');
    await user.type(screen.getByLabelText('Password'), 'initial-password');
    await user.click(screen.getByRole('button', { name: /sign in to admin/i }));
    expect(await screen.findByRole('heading', { name: 'Choose a new password' })).toBeTruthy();
    expect(screen.getByLabelText('Current password')).toBeTruthy();
  });

  it('rejects Customer credentials in the Admin login experience', async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValueOnce(response(customer));
    renderApp('/admin/login');
    await user.type(await screen.findByLabelText('Email address'), 'nila@example.com');
    await user.type(screen.getByLabelText('Password'), 'customer-password');
    await user.click(screen.getByRole('button', { name: /sign in to admin/i }));
    expect((await screen.findByRole('alert')).textContent).toContain('This account does not have Admin Panel access.');
    expect(window.sessionStorage.getItem('brazzars_access_token')).toBeNull();
  });

  it('validates password strength and posts confirmed changes to the backend', async () => {
    window.sessionStorage.setItem('brazzars_access_token', 'existing-admin-session');
    api.get.mockResolvedValueOnce({ data: { success: true, data: { user: { ...admin, mustChangePassword: true } } } });
    api.post.mockResolvedValueOnce({ data: { success: true, data: { user: admin } } });
    const user = userEvent.setup();
    renderApp('/admin/change-password');
    await user.type(await screen.findByLabelText('Current password'), 'initial-password');
    await user.type(screen.getByLabelText('New password'), 'weakpassword');
    await user.type(screen.getByLabelText('Confirm new password'), 'weakpassword');
    await user.click(screen.getByRole('button', { name: /change password and continue/i }));
    expect(screen.getByRole('alert').textContent).toContain('Use at least 12 characters');
    expect(api.post).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText('New password'));
    await user.type(screen.getByLabelText('New password'), 'SecureAdmin2026!');
    await user.clear(screen.getByLabelText('Confirm new password'));
    await user.type(screen.getByLabelText('Confirm new password'), 'SecureAdmin2026!');
    await user.click(screen.getByRole('button', { name: /change password and continue/i }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/auth/change-password', { currentPassword: 'initial-password', newPassword: 'SecureAdmin2026!' }));
    expect(await screen.findByRole('heading', { name: 'Dashboard overview' })).toBeTruthy();
  });
});
