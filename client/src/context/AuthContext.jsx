import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api.js';
import { clearAccessToken, getAccessToken, setAccessToken } from '../services/authStorage.js';

const AuthContext = createContext(null);

function readAuthPayload(response) {
  const payload = response?.data?.data;
  if (!payload?.user || !payload?.token) {
    throw new Error('Brazzars returned an unexpected authentication response.');
  }
  return payload;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');

  const clearSession = useCallback(() => {
    clearAccessToken();
    setUser(null);
    setStatus('anonymous');
  }, []);

  useEffect(() => {
    let active = true;
    const token = getAccessToken();

    if (!token) {
      setStatus('anonymous');
      return () => { active = false; };
    }

    api.get('/auth/me')
      .then((response) => {
        const restoredUser = response?.data?.data?.user;
        if (!restoredUser || !['customer', 'vendor', 'admin'].includes(restoredUser.role)) {
          throw new Error('The saved session is invalid.');
        }
        if (active) {
          setUser(restoredUser);
          setStatus('authenticated');
        }
      })
      .catch(() => {
        if (active) clearSession();
      });

    return () => { active = false; };
  }, [clearSession]);

  useEffect(() => {
    window.addEventListener('brazzars:unauthorized', clearSession);
    return () => window.removeEventListener('brazzars:unauthorized', clearSession);
  }, [clearSession]);

  const establishSession = useCallback(async (request) => {
    const payload = readAuthPayload(await request);
    setAccessToken(payload.token);
    setUser(payload.user);
    setStatus('authenticated');
    return payload;
  }, []);

  const login = useCallback((credentials) => establishSession(api.post('/auth/login', credentials)), [establishSession]);
  const registerCustomer = useCallback((details) => establishSession(api.post('/auth/register', details)), [establishSession]);
  const registerVendor = useCallback((details) => establishSession(api.post('/auth/register/vendor', details)), [establishSession]);

  const value = useMemo(() => ({
    user,
    status,
    isLoading: status === 'loading',
    isAuthenticated: status === 'authenticated' && Boolean(user),
    login,
    registerCustomer,
    registerVendor,
    logout: clearSession,
  }), [user, status, login, registerCustomer, registerVendor, clearSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
