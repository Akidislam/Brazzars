import { useEffect, useState } from 'react';
import { ArrowLeft, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getAuthErrorMessage } from '../services/authErrors.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { user, isLoading, login, logout } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.role === 'admin') navigate(user.mustChangePassword ? '/admin/change-password' : '/admin/dashboard', { replace: true });
  }, [user, navigate]);

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!EMAIL_PATTERN.test(email.trim()) || !password) { setError('Enter a valid email address and password.'); return; }
    setBusy(true);
    try {
      const result = await login({ email: email.trim(), password });
      if (result.user.role !== 'admin') {
        logout();
        setError('This account does not have Admin Panel access.');
        return;
      }
      navigate(result.user.mustChangePassword ? '/admin/change-password' : '/admin/dashboard', { replace: true });
    } catch (requestError) {
      setError(getAuthErrorMessage(requestError, 'We could not sign you in. Please try again.'));
    } finally { setBusy(false); }
  }

  return <main className="admin-auth-page"><header className="admin-auth-top"><Link to="/" className="admin-auth-brand"><span>B</span> brazzars<span>.</span></Link><Link to="/" className="admin-auth-back"><ArrowLeft size={15} /> Marketplace</Link></header><div className="admin-auth-grid"><section className="admin-auth-story"><div className="admin-auth-emblem"><ShieldCheck size={25} /></div><p>ADMINISTRATOR ACCESS</p><h1>One clear view of a marketplace in motion.</h1><span>Manage Brazzars operations through a dedicated, protected workspace.</span><div className="admin-auth-note"><span /> Private administrator sign-in · Bangladesh</div></section><section className="admin-auth-card"><div className="admin-auth-card-icon"><ShieldCheck size={19} /></div><p className="admin-auth-eyebrow">WELCOME BACK</p><h2>Admin sign in</h2><p className="admin-auth-description">Use your private administrator account to continue.</p>{!isLoading && user && user.role !== 'admin' && <div className="admin-auth-notice" role="status">You’re signed in with a non-admin account. Sign out before using Admin access.</div>}<form onSubmit={submit} noValidate><label htmlFor="admin-email">Email address</label><input id="admin-email" type="email" autoComplete="username" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@company.com" required /><label htmlFor="admin-password">Password</label><div className="admin-password-field"><input id="admin-password" type={visible ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required /><button type="button" onClick={() => setVisible((value) => !value)} aria-label={visible ? 'Hide password' : 'Show password'}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>{error && <p className="admin-auth-error" role="alert">{error}</p>}<button className="admin-auth-submit" disabled={busy || isLoading}>{busy ? 'Verifying access…' : 'Sign in to Admin'}<span>→</span></button></form><p className="admin-auth-footnote"><ShieldCheck size={14} /> Admin accounts are provisioned privately. Registration is closed.</p></section></div><footer className="admin-auth-footer">© 2026 Brazzars <span>·</span> Administrator access</footer></main>;
}
