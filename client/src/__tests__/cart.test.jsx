import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import api from '../services/api.js';
import { AuthProvider } from '../context/AuthContext.jsx';
import { CartProvider } from '../context/CartContext.jsx';
import App from '../App.jsx';

vi.mock('../services/api.js', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const products = {
  'woven-basket': { id: 'product-1', name: 'Woven Basket', slug: 'woven-basket', price: 100, stock: 2, status: 'approved', isActive: true, images: ['https://images.example.test/basket.jpg'], shop: { shopName: 'Jute House', slug: 'jute-house', status: 'approved' }, category: { name: 'Home & Living', slug: 'home-living' } },
  'sold-out-lamp': { id: 'product-2', name: 'Sold Out Lamp', slug: 'sold-out-lamp', price: 250, stock: 0, status: 'approved', isActive: true, images: [], shop: { shopName: 'Lamp Works', slug: 'lamp-works', status: 'approved' } },
};

function response(data) { return { data: { success: true, data } }; }

function renderApp(path = '/') {
  return render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AuthProvider><CartProvider><App /></CartProvider></AuthProvider></MemoryRouter>);
}

beforeEach(() => {
  products['woven-basket'].stock = 2;
  window.localStorage.clear();
  window.sessionStorage.clear();
  api.get.mockReset();
  api.get.mockImplementation(async (path) => {
    const match = path.match(/^\/products\/([^?]+)/);
    const slug = match ? decodeURIComponent(match[1]) : '';
    if (slug === 'missing-product') throw { response: { status: 404, data: { message: 'Product not found.' } } };
    if (products[slug]) return response({ product: products[slug] });
    return response({});
  });
  api.post.mockReset();
});

describe('customer cart', () => {
  it('lets a guest add an available product from its details page', async () => {
    const user = userEvent.setup();
    renderApp('/products/woven-basket');
    expect(await screen.findByRole('heading', { name: 'Woven Basket' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Log in' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByText('Added to your cart.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Cart, 1 item' })).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem('brazzars_cart_guest'))).toEqual([{ slug: 'woven-basket', quantity: 1 }]);
  });

  it('increments duplicate products, enforces stock, and prevents duplicate entries', async () => {
    const user = userEvent.setup();
    renderApp('/products/woven-basket');
    const addButton = await screen.findByRole('button', { name: 'Add to cart' });
    await user.click(addButton);
    await user.click(addButton);
    expect(await screen.findByRole('link', { name: 'Cart, 2 items' })).toBeTruthy();
    await user.click(addButton);
    expect(await screen.findByText('Only 2 of this item are currently available.')).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem('brazzars_cart_guest'))).toEqual([{ slug: 'woven-basket', quantity: 2 }]);
  });

  it('adds products from product cards without opening product details', async () => {
    const user = userEvent.setup();
    api.get.mockImplementation(async (path) => {
      if (path === '/products?sort=price_asc&limit=8') return response({ products: [products['woven-basket']], pagination: { page: 1, limit: 8, total: 1, pages: 1 } });
      if (path.startsWith('/products/')) return response({ product: products['woven-basket'] });
      if (path.startsWith('/categories?')) return response({ categories: [] });
      if (path.startsWith('/shops?')) return response({ shops: [] });
      return response({ products: [] });
    });
    renderApp('/');
    await user.click(await screen.findByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByText('Added to cart.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Find your next/ })).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem('brazzars_cart_guest'))).toEqual([{ slug: 'woven-basket', quantity: 1 }]);
  });

  it('changes quantity, calculates totals from product price, and removes items', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem('brazzars_cart_guest', JSON.stringify([{ slug: 'woven-basket', quantity: 1 }]));
    renderApp('/cart');
    expect(await screen.findByText('Woven Basket')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Increase Woven Basket quantity' }));
    expect(await screen.findByText(/BDT\s*200\.00/, { selector: '.cart-item-subtotal' })).toBeTruthy();
    expect(screen.getByText(/BDT\s*200\.00/, { selector: '.cart-summary-total strong' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Decrease Woven Basket quantity' }));
    expect(await screen.findByText(/BDT\s*100\.00/, { selector: '.cart-item-subtotal' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Remove Woven Basket' }));
    expect(await screen.findByText('Your cart is empty')).toBeTruthy();
  });

  it('persists the guest cart across page remounts and revalidates current stock', async () => {
    const user = userEvent.setup();
    const page = renderApp('/products/woven-basket');
    await user.click(await screen.findByRole('button', { name: 'Add to cart' }));
    page.unmount();
    renderApp('/cart');
    expect(await screen.findByText('Woven Basket')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Cart, 1 item' })).toBeTruthy();
  });

  it('rechecks availability when returning to the cart during the same session', async () => {
    const user = userEvent.setup();
    renderApp('/products/woven-basket');
    await user.click(await screen.findByRole('button', { name: 'Add to cart' }));
    products['woven-basket'].stock = 0;
    await user.click(screen.getByRole('link', { name: 'Cart, 1 item' }));
    expect(await screen.findByText('This item is out of stock.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Proceed to checkout' }).disabled).toBe(true);
    products['woven-basket'].stock = 2;
  });

  it('clamps a saved quantity to current stock and handles unavailable saved products', async () => {
    window.localStorage.setItem('brazzars_cart_guest', JSON.stringify([
      { slug: 'woven-basket', quantity: 8 },
      { slug: 'sold-out-lamp', quantity: 1 },
      { slug: 'missing-product', quantity: 1 },
    ]));
    renderApp('/cart');
    expect(await screen.findByText('Quantity updated to the 2 currently available.')).toBeTruthy();
    expect(await screen.findByText('This item is out of stock.')).toBeTruthy();
    expect(await screen.findByText('This product is no longer available.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Proceed to checkout' }).disabled).toBe(true);
    expect(JSON.parse(window.localStorage.getItem('brazzars_cart_guest'))[0].quantity).toBe(2);
  });

  it('shows a retryable error if saved product availability cannot be checked', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem('brazzars_cart_guest', JSON.stringify([{ slug: 'woven-basket', quantity: 1 }]));
    api.get.mockRejectedValue(new Error('network unavailable'));
    renderApp('/cart');
    expect((await screen.findByRole('alert')).textContent).toContain('Some saved cart items could not be checked.');
    expect(screen.getByRole('button', { name: 'Proceed to checkout' }).disabled).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Retry check' }));
    await screen.findByRole('alert');
    expect(api.get).toHaveBeenCalledWith('/products/woven-basket');
  });

  it('disables adding an out-of-stock product from product details', async () => {
    renderApp('/products/sold-out-lamp');
    expect(await screen.findByRole('heading', { name: 'Sold Out Lamp' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Out of stock' }).disabled).toBe(true);
    expect(window.localStorage.getItem('brazzars_cart_guest')).toBe('[]');
  });

  it('keeps authenticated customer cart data separate from the guest cart', async () => {
    const user = userEvent.setup();
    const customer = { id: 'customer-42', name: 'Nila Rahman', email: 'nila@example.test', role: 'customer' };
    window.sessionStorage.setItem('brazzars_access_token', 'customer-session-token');
    window.localStorage.setItem('brazzars_cart_guest', JSON.stringify([{ slug: 'sold-out-lamp', quantity: 1 }]));
    api.get.mockImplementation(async (path) => {
      if (path === '/auth/me') return response({ user: customer });
      const slug = path.split('/').at(-1);
      return products[slug] ? response({ product: products[slug] }) : response({});
    });
    renderApp('/products/woven-basket');
    await user.click(await screen.findByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByRole('link', { name: 'Cart, 1 item' })).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem('brazzars_cart_customer_customer-42'))).toEqual([{ slug: 'woven-basket', quantity: 1 }]);
    expect(JSON.parse(window.localStorage.getItem('brazzars_cart_guest'))).toEqual([{ slug: 'sold-out-lamp', quantity: 1 }]);
  });
});
