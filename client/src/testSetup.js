import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

const localStorageValues = new Map();
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: {
    getItem(key) { return localStorageValues.get(String(key)) ?? null; },
    setItem(key, value) { localStorageValues.set(String(key), String(value)); },
    removeItem(key) { localStorageValues.delete(String(key)); },
    clear() { localStorageValues.clear(); },
  },
});

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  window.localStorage.clear();
});
