export function getAuthErrorMessage(error, fallback = 'We could not complete that request. Please try again.') {
  const status = error?.response?.status;
  const message = error?.response?.data?.message;

  if (status === 400) return message || 'Please check the information and try again.';
  if (status === 401) return 'Email or password is incorrect, or this account is unavailable.';
  if (status === 403) return 'You do not have permission to access this area.';
  if (status === 409) return 'An account or shop with those details already exists.';
  if (status >= 500) return 'Brazzars is having trouble right now. Please try again shortly.';
  if (!error?.response) return 'We could not reach Brazzars. Check your connection and try again.';
  return fallback;
}
