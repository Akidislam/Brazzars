import { useEffect, useState } from 'react';
import api from '../services/api.js';

export default function useMarketplaceRequest(path, params = {}) {
  const query = new URLSearchParams(params).toString();
  const requestPath = query ? `${path}?${query}` : path;
  const [state, setState] = useState({ data: null, loading: true, error: '' });

  useEffect(() => {
    let active = true;
    setState({ data: null, loading: true, error: '' });
    api.get(requestPath)
      .then((response) => {
        if (!active) return;
        setState({ data: response?.data?.data ?? null, loading: false, error: '' });
      })
      .catch((error) => {
        if (!active) return;
        setState({ data: null, loading: false, error: error?.response?.data?.message ?? 'We could not load this right now. Please try again.' });
      });
    return () => { active = false; };
  }, [requestPath]);

  return state;
}
