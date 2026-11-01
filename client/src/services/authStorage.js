const TOKEN_KEY = 'brazzars_access_token';

export function getAccessToken() {
  try {
    return window.sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAccessToken(token) {
  try {
    window.sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    throw new Error('This browser could not save your session. Please enable session storage and try again.');
  }
}

export function clearAccessToken() {
  try {
    window.sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // The in-memory auth state is cleared even if browser storage is unavailable.
  }
}
