import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import api from '../services/api.js';
import { AuthProvider } from '../context/AuthContext.jsx';
import App from '../App.jsx';

vi.mock('../services/api.js', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

function renderMarketplace(path = '/') {
  return render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AuthProvider><App /></AuthProvider></MemoryRouter>);
}

function response(data) {
  return { data: { success: true, data } };
}

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.get.mockImplementation(async (path) => {
    if (path.startsWith('/categories?')) return response({ categories: [{ id: 'cat1', name: 'Home & Living', slug: 'home-living' }], pagination: { page: 1, limit: 8, total: 1, pages: 1 } });
    if (path === '/categories/home-living') return response({ category: { name: 'Home & Living', slug: 'home-living' } });
    if (path.startsWith('/categories/home-living/products')) return response({ products: [{ id: 'p1', name: 'Woven Basket', slug: 'woven-basket', price: 850, images: [], shop: { shopName: 'Jute House', slug: 'jute-house' }, category: { name: 'Home & Living', slug: 'home-living' } }], pagination: { page: 1, limit: 20, total: 1, pages: 1 } });
    if (path.startsWith('/products?search=') && path.includes('woven')) return response({ products: [{ id: 'p1', name: 'Woven Basket', slug: 'woven-basket', price: 850, images: [], shop: { shopName: 'Jute House', slug: 'jute-house' }, category: { name: 'Home & Living', slug: 'home-living' } }], pagination: { page: 1, limit: 20, total: 1, pages: 1 } });
    if (path.startsWith('/products?')) return response({ products: [], pagination: { page: 1, limit: 8, total: 0, pages: 0 } });
    if (path.startsWith('/shops?')) return response({ shops: [], pagination: { page: 1, limit: 4, total: 0, pages: 0 } });
    return response({});
  });
});

describe('customer marketplace discovery', () => {
  it('loads categories from the backend and navigates to category products', async () => {
    const user = userEvent.setup();
    renderMarketplace();

    await user.click(await screen.findByRole('link', { name: /Home & Living/ }));
    expect(await screen.findByRole('heading', { name: 'Home & Living' })).toBeTruthy();
    expect(await screen.findByRole('link', { name: 'View Woven Basket' })).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/categories?limit=8');
    expect(api.get).toHaveBeenCalledWith('/categories/home-living/products?page=1&limit=20&sort=newest');
  });

  it('submits global search and keeps the query in the results route', async () => {
    const user = userEvent.setup();
    renderMarketplace();
    await user.type(screen.getByRole('textbox', { name: 'Search products' }), 'woven basket');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByRole('heading', { name: 'Results for “woven basket”' })).toBeTruthy();
    expect(await screen.findByRole('link', { name: 'View Woven Basket' })).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/products?search=woven+basket&page=1&limit=20&sort=newest');
  });

  it('shows an API error instead of substituting sample marketplace data', async () => {
    api.get.mockImplementation(async (path) => {
      if (path.startsWith('/categories?')) throw { response: { data: { message: 'Categories are temporarily unavailable.' } } };
      if (path.startsWith('/products?')) return response({ products: [], pagination: { page: 1, limit: 8, total: 0, pages: 0 } });
      if (path.startsWith('/shops?')) return response({ shops: [], pagination: { page: 1, limit: 4, total: 0, pages: 0 } });
      return response({});
    });
    renderMarketplace();
    expect((await screen.findByRole('alert')).textContent).toContain('Categories are temporarily unavailable.');
    expect(screen.queryByText('Home & Living')).toBeNull();
  });

  it('shows a truthful empty state when the product API has no products', async () => {
    renderMarketplace('/search?q=unlisted');
    expect(await screen.findByText('No matching products')).toBeTruthy();
    expect(screen.queryByText(/ratings|reviews/i)).toBeNull();
  });
});
