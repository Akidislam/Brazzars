import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout.jsx';
import { FormField, PasswordField } from '../components/auth/FormField.jsx';
import FormNotice from '../components/auth/FormNotice.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getAuthErrorMessage } from '../services/authErrors.js';
import { roleHomePaths } from '../routes/ProtectedRoute.jsx';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage({ accountType = 'customer' }) {
  const vendor = accountType === 'vendor';
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (!EMAIL_PATTERN.test(email.trim()) || !password) {
      setError('Enter a valid email address and password.');
      return;
    }

    setBusy(true);
    try {
      const result = await login({ email: email.trim(), password });
      navigate(roleHomePaths[result.user.role] ?? '/', {
        replace: true,
        state: { notice: 'Welcome back to Brazzars.' },
      });
    } catch (requestError) {
      setError(getAuthErrorMessage(requestError, 'We could not sign you in. Please try again.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      kind={vendor ? 'vendor' : 'customer'}
      eyebrow={vendor ? 'SELLER SIGN IN' : 'WELCOME BACK'}
      title={vendor ? 'Sign in to your shop.' : 'Sign in to Brazzars.'}
      description={vendor ? 'Manage your seller account and keep your shop moving.' : 'Your next local find is just around the corner.'}
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <FormNotice>{error}</FormNotice>
        <FormField
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
        />
        <PasswordField
          label="Password"
          name="password"
          autoComplete="current-password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Enter your password"
        />
        <button className="auth-submit" type="submit" disabled={busy}>
          {busy ? 'Signing you in…' : 'Sign in'}
          {!busy && <span aria-hidden="true">→</span>}
        </button>
        <p className="auth-switch">
          {vendor ? 'New to selling on Brazzars?' : 'New to Brazzars?'}{' '}
          <Link to={vendor ? '/vendor/register' : '/register'}>{vendor ? 'Open a seller account' : 'Create an account'}</Link>
        </p>
        {!vendor && <p className="auth-secondary-link">Are you a seller? <Link to="/vendor/login">Sign in to your shop</Link></p>}
      </form>
    </AuthLayout>
  );
}
