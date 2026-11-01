import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import api from '../services/api.js';
import { AuthProvider } from '../context/AuthContext.jsx';
import App from '../App.jsx';

vi.mock('../services/api.js', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

const customer = { id: '64f000000000000000000001', name: 'Nila Rahman', email: 'nila@example.com', role: 'customer', isActive: true };
const vendor = { id: '64f000000000000000000002', name: 'Tariq Hasan', email: 'tariq@example.com', role: 'vendor', isActive: true };
const admin = { id: '64f000000000000000000003', name: 'Brazzars Admin', email: 'admin@example.com', role: 'admin', isActive: true };

function renderApp(path) {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider><App /></AuthProvider>
    </MemoryRouter>,
  );
}

function authResponse(user, extra = {}) {
  return { data: { success: true, data: { user, token: 'mock-access-token', ...extra } } };
}

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.get.mockResolvedValue({ data: { success: true, data: { user: customer } } });
});

describe('customer and vendor registration', () => {
  it('registers a customer through the backend and opens the account area', async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValueOnce(authResponse(customer));
    renderApp('/register');

    await user.type(await screen.findByLabelText('Full name'), 'Nila Rahman');
    await user.type(screen.getByLabelText('Email address'), 'nila@example.com');
    await user.type(screen.getByLabelText('Phone number'), '+880 1700 000000');
    await user.type(screen.getByLabelText('Password', { selector: 'input' }), 'a-safe-test-password');
    await user.type(screen.getByLabelText('Confirm password', { selector: 'input' }), 'a-safe-test-password');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('heading', { name: 'Your account' })).toBeTruthy();
    expect(api.post).toHaveBeenCalledWith('/auth/register', {
      name: 'Nila Rahman', email: 'nila@example.com', password: 'a-safe-test-password', phone: '+880 1700 000000',
    });
    expect(window.sessionStorage.getItem('brazzars_access_token')).toBe('mock-access-token');
  });

  it('validates password confirmation before making a request', async () => {
    const user = userEvent.setup();
    renderApp('/register');
    await user.type(await screen.findByLabelText('Full name'), 'Nila Rahman');
    await user.type(screen.getByLabelText('Email address'), 'nila@example.com');
    await user.type(screen.getByLabelText('Password', { selector: 'input' }), 'a-safe-test-password');
    await user.type(screen.getByLabelText('Confirm password', { selector: 'input' }), 'a-different-password');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByText('Passwords do not match.')).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('registers a vendor, submits the required shop fields, and shows pending approval', async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValueOnce(authResponse(vendor, {
      shop: { id: '64f000000000000000000010', shopName: 'Nila Crafts', slug: 'nila-crafts', status: 'pending' },
    }));
    renderApp('/vendor/register');

    await user.type(await screen.findByLabelText('Owner full name'), 'Tariq Hasan');
    await user.type(screen.getByLabelText('Email address'), 'tariq@example.com');
    await user.type(screen.getByLabelText('Phone number'), '+880 1700 000000');
    await user.type(screen.getByLabelText('Shop name'), 'Nila Crafts');
    await user.clear(screen.getByLabelText('Shop URL name'));
    await user.type(screen.getByLabelText('Shop URL name'), 'nila-crafts');
    await user.type(screen.getByLabelText('Shop description'), 'Handmade home pieces');
    await user.type(screen.getByLabelText('Shop contact email'), 'shop@example.com');
    await user.type(screen.getByLabelText('Shop contact phone'), '+880 1700 111111');
    await user.type(screen.getByLabelText('Password', { selector: 'input' }), 'a-safe-test-password');
    await user.type(screen.getByLabelText('Confirm password', { selector: 'input' }), 'a-safe-test-password');
    await user.click(screen.getByRole('button', { name: 'Submit shop application' }));

    expect(await screen.findByText(/Pending Admin approval/)).toBeTruthy();
    expect(api.post).toHaveBeenCalledWith('/auth/register/vendor', expect.objectContaining({
      name: 'Tariq Hasan', email: 'tariq@example.com', phone: '+880 1700 000000',
      shop: expect.objectContaining({ shopName: 'Nila Crafts', slug: 'nila-crafts', description: 'Handmade home pieces' }),
    }));
  });

  it('shows a friendly duplicate-account message', async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValueOnce({ response: { status: 409, data: { message: 'Email is already registered.' } } });
    renderApp('/register');
    await user.type(await screen.findByLabelText('Full name'), 'Nila Rahman');
    await user.type(screen.getByLabelText('Email address'), 'nila@example.com');
    await user.type(screen.getByLabelText('Password', { selector: 'input' }), 'a-safe-test-password');
    await user.type(screen.getByLabelText('Confirm password', { selector: 'input' }), 'a-safe-test-password');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect((await screen.findByRole('alert')).textContent).toContain('An account or shop with those details already exists.');
  });
});

describe('login, session restoration, and logout', () => {
  it('logs in through the shared endpoint and redirects based on the verified vendor role', async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValueOnce(authResponse(vendor));
    renderApp('/login');
    await user.type(await screen.findByLabelText('Email address'), 'tariq@example.com');
    await user.type(screen.getByLabelText('Password', { selector: 'input' }), 'a-safe-test-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { name: 'Your seller dashboard' })).toBeTruthy();
    expect(api.post).toHaveBeenCalledWith('/auth/login', { email: 'tariq@example.com', password: 'a-safe-test-password' });
  });

  it('uses the actual customer role returned by backend even on the vendor login page', async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValueOnce(authResponse(customer));
    renderApp('/vendor/login');
    await user.type(await screen.findByLabelText('Email address'), 'nila@example.com');
    await user.type(screen.getByLabelText('Password', { selector: 'input' }), 'a-safe-test-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { name: 'Your account' })).toBeTruthy();
  });

  it('shows a generic credential error for inactive or invalid accounts', async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValueOnce({ response: { status: 401, data: { message: 'Invalid email or password.' } } });
    renderApp('/login');
    await user.type(await screen.findByLabelText('Email address'), 'nila@example.com');
    await user.type(screen.getByLabelText('Password', { selector: 'input' }), 'a-safe-test-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Email or password is incorrect, or this account is unavailable.');
  });

  it('restores the session by validating the token with /auth/me', async () => {
    window.sessionStorage.setItem('brazzars_access_token', 'saved-session-token');
    api.get.mockResolvedValueOnce({ data: { success: true, data: { user: vendor } } });
    renderApp('/vendor/dashboard');

    expect(await screen.findByRole('heading', { name: 'Your seller dashboard' })).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/auth/me');
  });

  it('clears an invalid or expired session and sends the guest to login', async () => {
    window.sessionStorage.setItem('brazzars_access_token', 'expired-or-invalid');
    api.get.mockRejectedValueOnce({ response: { status: 401 } });
    renderApp('/account');

    expect(await screen.findByRole('heading', { name: 'Sign in to Brazzars.' })).toBeTruthy();
    await waitFor(() => expect(window.sessionStorage.getItem('brazzars_access_token')).toBeNull());
  });

  it('logs out and clears the session token', async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValueOnce(authResponse(customer));
    renderApp('/login');
    await user.type(await screen.findByLabelText('Email address'), 'nila@example.com');
    await user.type(screen.getByLabelText('Password', { selector: 'input' }), 'a-safe-test-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await user.click(await screen.findByRole('button', { name: 'Log out' }));

    expect(window.sessionStorage.getItem('brazzars_access_token')).toBeNull();
    expect(await screen.findByRole('heading', { name: /Find your/ })).toBeTruthy();
  });
});

describe('protected routes and roles', () => {
  it('redirects guests from a protected vendor page to vendor login', async () => {
    renderApp('/vendor/dashboard');
    expect(await screen.findByRole('heading', { name: 'Sign in to your shop.' })).toBeTruthy();
  });

  it('keeps customers out of vendor routes using the role returned by /auth/me', async () => {
    window.sessionStorage.setItem('brazzars_access_token', 'customer-session-token');
    api.get.mockResolvedValueOnce({ data: { success: true, data: { user: customer } } });
    renderApp('/vendor/dashboard');
    expect(await screen.findByRole('heading', { name: 'Your account' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Your seller dashboard' })).toBeNull();
  });

  it('keeps vendors out of admin routes and redirects to their vendor area', async () => {
    window.sessionStorage.setItem('brazzars_access_token', 'vendor-session-token');
    api.get.mockResolvedValueOnce({ data: { success: true, data: { user: vendor } } });
    renderApp('/admin/dashboard');
    expect(await screen.findByRole('heading', { name: 'Your seller dashboard' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Admin workspace' })).toBeNull();
  });

  it('allows a backend-verified admin session into the admin placeholder', async () => {
    window.sessionStorage.setItem('brazzars_access_token', 'admin-session-token');
    api.get.mockResolvedValueOnce({ data: { success: true, data: { user: admin } } });
    renderApp('/admin/dashboard');
    expect(await screen.findByRole('heading', { name: 'Admin workspace' })).toBeTruthy();
  });
});
