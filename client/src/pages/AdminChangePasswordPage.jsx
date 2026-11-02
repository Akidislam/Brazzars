import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import AdminLayout from '../layouts/AdminLayout.jsx';

export default function AdminChangePasswordPage() {
  const { user, changePassword, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  function update(event) { setForm((current) => ({ ...current, [event.target.name]: event.target.value })); }

  async function submit(event) {
    event.preventDefault(); setError(''); setSuccess('');
    if (form.newPassword.length < 12 || !/[a-z]/.test(form.newPassword) || !/[A-Z]/.test(form.newPassword) || !/\d/.test(form.newPassword) || !/[^A-Za-z\d]/.test(form.newPassword)) {
      setError('Use at least 12 characters with uppercase, lowercase, a number, and a symbol.'); return;
    }
    if (form.newPassword !== form.confirmPassword) { setError('The new passwords do not match.'); return; }
    setBusy(true);
    try {
      await changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      setSuccess('Your password has been changed.');
      navigate('/admin/dashboard', { replace: true, state: { notice: 'Your initial password was changed successfully.' } });
    } catch (requestError) {
      setError(requestError.response?.data?.message ?? 'Could not change your password. Please try again.');
    } finally { setBusy(false); }
  }

  function signOut() { logout(); navigate('/admin/login', { replace: true }); }
  return <AdminLayout><main className="admin-change-page"><div className="admin-page-heading"><p>SECURITY SETUP</p><h1>Choose a new password</h1><span>Your initial password is temporary. Change it now to unlock your Admin workspace.</span></div><section className="admin-change-card"><div className="admin-change-icon">✓</div><h2>Secure your administrator account</h2><p>Signed in as <strong>{user?.email}</strong>. Your new password must be at least 12 characters and include uppercase, lowercase, a number, and a symbol.</p><form onSubmit={submit} noValidate>{[['currentPassword','Current password','current-password'],['newPassword','New password','new-password'],['confirmPassword','Confirm new password','new-password']].map(([name,label,autocomplete]) => <label className="admin-change-field" key={name}>{label}<input name={name} type="password" autoComplete={autocomplete} value={form[name]} onChange={update} required minLength={name === 'currentPassword' ? 1 : 12} /></label>)}{error && <div className="admin-auth-error" role="alert">{error}</div>}{success && <div className="admin-change-success" role="status">{success}</div>}<button className="admin-auth-submit" disabled={busy}>{busy ? 'Updating password…' : 'Change password and continue'}<span>→</span></button></form><button type="button" className="admin-change-signout" onClick={signOut}>Sign out instead</button></section></main></AdminLayout>;
}
