import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api from '../services/api.js';
import { useAuth } from './AuthContext.jsx';

const CartContext = createContext(null);
const GUEST_CART_KEY = 'brazzars_cart_guest';

function getCartKey(user, status) {
  if (status === 'loading') return null;
  if (user?.role === 'customer') {
    const identity = user.id ?? user._id ?? user.email;
    if (identity) return `brazzars_cart_customer_${encodeURIComponent(String(identity).toLowerCase())}`;
  }
  return GUEST_CART_KEY;
}

function readStoredCart(key) {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) ?? '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((item) => typeof item?.slug === 'string' && item.slug.length > 0
      && Number.isSafeInteger(item.quantity) && item.quantity >= 1)
      .map(({ slug, quantity }) => ({ slug, quantity, product: null, status: 'checking', reason: '' }));
  } catch {
    return [];
  }
}

function isPublicProduct(product) {
  if (!product || typeof product !== 'object') return false;
  if (product.status && product.status !== 'approved') return false;
  if (product.isActive === false) return false;
  if (product.shop?.status && product.shop.status !== 'approved') return false;
  if (product.shop?.isActive === false) return false;
  return Number.isFinite(Number(product.price)) && Number(product.price) > 0
    && Number.isSafeInteger(Number(product.stock)) && Number(product.stock) >= 0;
}

async function fetchPublicProduct(slug) {
  try {
    const response = await api.get(`/products/${encodeURIComponent(slug)}`);
    const product = response?.data?.data?.product;
    if (!isPublicProduct(product)) {
      const error = new Error('This product is not available to add to your cart.');
      error.code = 'UNAVAILABLE';
      throw error;
    }
    return product;
  } catch (error) {
    if (error.code === 'UNAVAILABLE') throw error;
    if (error.response?.status === 404) {
      const unavailable = new Error('This product is no longer available.');
      unavailable.code = 'UNAVAILABLE';
      throw unavailable;
    }
    throw new Error(error.response?.data?.message ?? 'We could not verify this product. Please try again.');
  }
}

function normalizeEntry(product, quantity) {
  if (Number(product.stock) < 1) return { slug: product.slug, quantity, product, status: 'unavailable', reason: 'This item is out of stock.' };
  const safeQuantity = Math.min(quantity, Number(product.stock));
  return {
    slug: product.slug,
    quantity: safeQuantity,
    product,
    status: 'available',
    reason: safeQuantity < quantity ? `Quantity updated to the ${safeQuantity} currently available.` : '',
  };
}

export function CartProvider({ children }) {
  const { user, status: authStatus } = useAuth();
  const cartKey = getCartKey(user, authStatus);
  const [items, setItems] = useState([]);
  const [loadedKey, setLoadedKey] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [addingSlugs, setAddingSlugs] = useState([]);
  const itemsRef = useRef(items);
  const activeKeyRef = useRef(cartKey);

  const commitItems = useCallback((nextItems) => {
    itemsRef.current = nextItems;
    setItems(nextItems);
  }, []);

  const validateSavedItems = useCallback(async (key, savedItems, active) => {
    const verified = await Promise.all(savedItems.map(async (item) => {
      try {
        const product = await fetchPublicProduct(item.slug);
        return normalizeEntry(product, item.quantity);
      } catch (error) {
        return {
          ...item,
          product: null,
          status: error.code === 'UNAVAILABLE' ? 'unavailable' : 'error',
          reason: error.message,
        };
      }
    }));
    if (active() && activeKeyRef.current === key) {
      commitItems(verified);
      setLoadError(verified.some((item) => item.status === 'error')
        ? 'Some saved cart items could not be checked. Retry when your connection is available.'
        : '');
      setIsLoading(false);
    }
  }, [commitItems]);

  useEffect(() => {
    activeKeyRef.current = cartKey;
    if (!cartKey) return undefined;
    let active = true;
    const stored = readStoredCart(cartKey);
    commitItems(stored);
    setLoadedKey(cartKey);
    setLoadError('');
    setIsLoading(stored.length > 0);
    if (stored.length) void validateSavedItems(cartKey, stored, () => active);
    return () => { active = false; };
  }, [cartKey, commitItems, validateSavedItems]);

  useEffect(() => {
    if (!cartKey || loadedKey !== cartKey) return;
    const serializable = items.map(({ slug, quantity }) => ({ slug, quantity }));
    try {
      window.localStorage.setItem(cartKey, JSON.stringify(serializable));
    } catch {
      setLoadError('Your browser could not save the cart. Check local storage settings.');
    }
  }, [cartKey, items, loadedKey]);

  const addProduct = useCallback(async (slug, requestedQuantity = 1) => {
    if (!Number.isSafeInteger(requestedQuantity) || requestedQuantity < 1) throw new Error('Choose a quantity of at least 1.');
    if (!cartKey || loadedKey !== cartKey || isLoading) throw new Error('Your cart is still being checked. Please try again shortly.');
    setAddingSlugs((current) => current.includes(slug) ? current : [...current, slug]);
    try {
      const product = await fetchPublicProduct(slug);
      if (Number(product.stock) < 1) {
        const error = new Error('This product is out of stock.');
        error.code = 'UNAVAILABLE';
        throw error;
      }
      const current = itemsRef.current;
      const existing = current.find((item) => item.slug === product.slug);
      const nextQuantity = (existing?.quantity ?? 0) + requestedQuantity;
      if (nextQuantity > Number(product.stock)) throw new Error(`Only ${product.stock} of this item are currently available.`);
      const entry = { slug: product.slug, quantity: nextQuantity, product, status: 'available', reason: '' };
      commitItems(existing
        ? current.map((item) => item.slug === product.slug ? entry : item)
        : [...current, entry]);
      setLoadError('');
      return entry;
    } finally {
      setAddingSlugs((current) => current.filter((item) => item !== slug));
    }
  }, [cartKey, loadedKey, isLoading, commitItems]);

  const setQuantity = useCallback((slug, quantity) => {
    if (!cartKey || loadedKey !== cartKey || isLoading) throw new Error('Your cart is still being checked. Please try again shortly.');
    if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error('Quantity must be at least 1.');
    const current = itemsRef.current;
    const item = current.find((entry) => entry.slug === slug);
    if (!item || item.status !== 'available' || !item.product) throw new Error('This item is not currently available.');
    if (quantity > Number(item.product.stock)) throw new Error(`Only ${item.product.stock} of this item are currently available.`);
    commitItems(current.map((entry) => entry.slug === slug ? { ...entry, quantity } : entry));
  }, [cartKey, loadedKey, isLoading, commitItems]);

  const removeProduct = useCallback((slug) => {
    if (!cartKey || loadedKey !== cartKey) return;
    commitItems(itemsRef.current.filter((item) => item.slug !== slug));
  }, [cartKey, loadedKey, commitItems]);

  const refreshCart = useCallback(async () => {
    if (!cartKey) return;
    const saved = itemsRef.current.map(({ slug, quantity }) => ({ slug, quantity, product: null, status: 'checking', reason: '' }));
    commitItems(saved);
    setIsLoading(saved.length > 0);
    setLoadError('');
    await validateSavedItems(cartKey, saved, () => activeKeyRef.current === cartKey);
  }, [cartKey, commitItems, validateSavedItems]);

  const visibleItems = loadedKey === cartKey ? items : [];
  const isReady = Boolean(cartKey && loadedKey === cartKey);
  const itemCount = visibleItems.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = visibleItems.reduce((sum, item) => item.status === 'available' && item.product
    ? sum + Number(item.product.price) * item.quantity : sum, 0);
  const value = useMemo(() => ({
    items: visibleItems,
    itemCount,
    subtotal,
    isReady,
    isLoading,
    loadError,
    addingSlugs,
    addProduct,
    setQuantity,
    removeProduct,
    refreshCart,
  }), [visibleItems, itemCount, subtotal, isReady, isLoading, loadError, addingSlugs, addProduct, setQuantity, removeProduct, refreshCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used inside CartProvider.');
  return context;
}
