import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../services/api.js';
import { clearAccessToken, getAccessToken, setAccessToken } from '../services/authStorage.js';
import { getAuthErrorMessage } from '../services/authErrors.js';

const requestInterceptor = api.interceptors.request.handlers.find((handler) => handler.fulfilled)?.fulfilled;
const responseInterceptor = api.interceptors.response.handlers.find((handler) => handler.rejected)?.rejected;

beforeEach(() => {
  clearAccessToken();
});

describe('Axios auth interceptor', () => {
  it('adds the Bearer token from sessionStorage to authenticated requests', async () => {
    setAccessToken('test-session-token');
    const config = await requestInterceptor({ headers: {} });
    expect(config.headers.Authorization).toBe('Bearer test-session-token');
    expect(config.__brazzarsHadToken).toBe(true);
  });

  it('clears a rejected session after an authenticated 401 response', async () => {
    setAccessToken('test-session-token');
    const onUnauthorized = vi.fn();
    window.addEventListener('brazzars:unauthorized', onUnauthorized);
    const error = { response: { status: 401 }, config: { __brazzarsHadToken: true } };

    await expect(responseInterceptor(error)).rejects.toBe(error);
    expect(getAccessToken()).toBeNull();
    expect(onUnauthorized).toHaveBeenCalledOnce();
    window.removeEventListener('brazzars:unauthorized', onUnauthorized);
  });
});

describe('authentication error messages', () => {
  it('maps validation, unauthorized, forbidden, conflict, server, and network errors safely', () => {
    expect(getAuthErrorMessage({ response: { status: 400, data: { message: 'Enter your name.' } } })).toBe('Enter your name.');
    expect(getAuthErrorMessage({ response: { status: 401, data: { message: 'Internal detail' } } })).toContain('Email or password is incorrect');
    expect(getAuthErrorMessage({ response: { status: 403 } })).toContain('permission');
    expect(getAuthErrorMessage({ response: { status: 409 } })).toContain('already exists');
    expect(getAuthErrorMessage({ response: { status: 500, data: { message: 'Stack trace detail' } } })).not.toContain('Stack trace detail');
    expect(getAuthErrorMessage(new Error('offline'))).toContain('could not reach Brazzars');
  });
});
