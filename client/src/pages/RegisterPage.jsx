import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout.jsx';
import { FormField, PasswordField } from '../components/auth/FormField.jsx';
import FormNotice from '../components/auth/FormNotice.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getAuthErrorMessage } from '../services/authErrors.js';
import { roleHomePaths } from '../routes/ProtectedRoute.jsx';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function slugify(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function RegisterPage({ accountType = 'customer' }) {
  const vendor = accountType === 'vendor';
  const navigate = useNavigate();
  const location = useLocation();
  const { registerCustomer, registerVendor } = useAuth();
  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '', confirmPassword: '',
    shopName: '', slug: '', description: '', contactEmail: '', contactPhone: '',
  });
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);

  function update(field, value) {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === 'shopName' && !slugEdited) next.slug = slugify(value);
      return next;
    });
    setFieldErrors((current) => ({ ...current, [field]: '' }));
    setError('');
  }

  function validate() {
    const errors = {};
    if (!form.name.trim()) errors.name = 'Enter your full name.';
    if (!EMAIL_PATTERN.test(form.email.trim())) errors.email = 'Enter a valid email address.';
    if (form.phone.trim().length > 30) errors.phone = 'Phone number must be 30 characters or fewer.';
    if (form.password.length < 8 || form.password.length > 128) errors.password = 'Use 8 to 128 characters.';
    if (form.confirmPassword !== form.password) errors.confirmPassword = 'Passwords do not match.';
    if (vendor && !form.shopName.trim()) errors.shopName = 'Enter a name for your shop.';
    if (vendor && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) errors.slug = 'Use lowercase letters, numbers, and single hyphens.';
    if (vendor && form.contactEmail && !EMAIL_PATTERN.test(form.contactEmail.trim())) errors.contactEmail = 'Enter a valid contact email.';
    if (vendor && form.contactPhone.trim().length > 30) errors.contactPhone = 'Phone number must be 30 characters or fewer.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (!validate()) return;

    setBusy(true);
    try {
      let result;
      if (vendor) {
        result = await registerVendor({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
          shop: {
            shopName: form.shopName.trim(),
            slug: form.slug.trim(),
            ...(form.description.trim() ? { description: form.description.trim() } : {}),
            ...(form.contactEmail.trim() ? { contactEmail: form.contactEmail.trim() } : {}),
            ...(form.contactPhone.trim() ? { contactPhone: form.contactPhone.trim() } : {}),
          },
        });
      } else {
        result = await registerCustomer({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
        });
      }

      const returnToCheckout = !vendor && result.user.role === 'customer' && location.state?.from?.pathname === '/checkout';
      navigate(returnToCheckout ? '/checkout' : (roleHomePaths[result.user.role] ?? '/'), {
        replace: true,
        state: vendor
          ? { shopStatus: result.shop?.status, notice: 'Your application is in. Your shop needs Admin approval before it can be listed.' }
          : { notice: 'Your Brazzars account is ready. Welcome in!' },
      });
    } catch (requestError) {
      setError(getAuthErrorMessage(requestError, 'We could not create your account. Please try again.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      kind={vendor ? 'vendor' : 'customer'}
      eyebrow={vendor ? 'JOIN AS A SELLER' : 'A GOOD PLACE TO START'}
      title={vendor ? 'Bring your shop to Brazzars.' : 'Make yourself at home.'}
      description={vendor ? 'Tell us about you and your shop. Admin approval is required before your shop goes live.' : 'Create an account to keep your local discoveries close.'}
    >
      <form className="auth-form auth-form-register" onSubmit={handleSubmit} noValidate>
        <FormNotice>{error}</FormNotice>
        <FormField label={vendor ? 'Owner full name' : 'Full name'} name="name" autoComplete="name" required maxLength={100} value={form.name} onChange={(event) => update('name', event.target.value)} error={fieldErrors.name} placeholder="Your name" />
        <div className="auth-form-row">
          <FormField label="Email address" name="email" type="email" autoComplete="email" inputMode="email" required value={form.email} onChange={(event) => update('email', event.target.value)} error={fieldErrors.email} placeholder="you@example.com" />
          <FormField label="Phone number" name="phone" type="tel" autoComplete="tel" maxLength={30} value={form.phone} onChange={(event) => update('phone', event.target.value)} error={fieldErrors.phone} hint="Optional" placeholder="+880…" />
        </div>

        {vendor && <>
          <div className="auth-section-heading"><span>YOUR SHOP</span><span>Admin approval required</span></div>
          <FormField label="Shop name" name="shopName" required maxLength={120} value={form.shopName} onChange={(event) => update('shopName', event.target.value)} error={fieldErrors.shopName} placeholder="e.g. Handmade Home" />
          <FormField label="Shop URL name" name="slug" required value={form.slug} onChange={(event) => { setSlugEdited(true); update('slug', event.target.value.toLowerCase()); }} error={fieldErrors.slug} hint="Lowercase letters, numbers, and hyphens." placeholder="handmade-home" />
          <FormField label="Shop description" name="description" as="textarea" rows={3} maxLength={2000} value={form.description} onChange={(event) => update('description', event.target.value)} hint="Optional" placeholder="What makes your shop special?" />
          <div className="auth-form-row">
            <FormField label="Shop contact email" name="contactEmail" type="email" autoComplete="email" value={form.contactEmail} onChange={(event) => update('contactEmail', event.target.value)} error={fieldErrors.contactEmail} hint="Optional" placeholder="shop@example.com" />
            <FormField label="Shop contact phone" name="contactPhone" type="tel" autoComplete="tel" maxLength={30} value={form.contactPhone} onChange={(event) => update('contactPhone', event.target.value)} error={fieldErrors.contactPhone} hint="Optional" placeholder="+880…" />
          </div>
        </>}

        <div className="auth-form-row">
          <PasswordField label="Password" name="password" autoComplete="new-password" required minLength={8} maxLength={128} value={form.password} onChange={(event) => update('password', event.target.value)} error={fieldErrors.password} placeholder="At least 8 characters" />
          <PasswordField label="Confirm password" name="confirmPassword" autoComplete="new-password" required value={form.confirmPassword} onChange={(event) => update('confirmPassword', event.target.value)} error={fieldErrors.confirmPassword} placeholder="Enter it again" />
        </div>
        <button className="auth-submit" type="submit" disabled={busy}>
          {busy ? (vendor ? 'Sending your application…' : 'Creating your account…') : (vendor ? 'Submit shop application' : 'Create account')}
          {!busy && <span aria-hidden="true">→</span>}
        </button>
        <p className="auth-switch">Already have an account? <Link to={vendor ? '/vendor/login' : '/login'} state={location.state}>{vendor ? 'Seller sign in' : 'Sign in'}</Link></p>
        {!vendor && <p className="auth-secondary-link">Selling something good? <Link to="/vendor/register">Open a seller account</Link></p>}
        {vendor && <p className="auth-approval-note">Submitting creates a pending shop. It will not appear publicly until an Admin approves it.</p>}
      </form>
    </AuthLayout>
  );
}
