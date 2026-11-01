import { ArrowLeft, ShieldCheck, Store } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AuthLayout({ kind = 'customer', eyebrow, title, description, children }) {
  const vendor = kind === 'vendor';

  return (
    <main className="auth-page">
      <header className="auth-topbar">
        <Link className="auth-brand" to="/" aria-label="Brazzars home">brazzars<span>.</span></Link>
        <Link className="auth-back" to="/"><ArrowLeft size={16} /> Back to marketplace</Link>
      </header>

      <div className="auth-shell">
        <aside className={`auth-aside ${vendor ? 'auth-aside-vendor' : ''}`}>
          <div className="auth-aside-icon">{vendor ? <Store size={23} /> : <ShieldCheck size={23} />}</div>
          <p className="auth-eyebrow">{vendor ? 'SELL SOMETHING GOOD' : 'A MORE LOCAL WAY TO SHOP'}</p>
          <h1>{vendor ? 'Your next chapter starts here.' : 'Find your kind of good.'}</h1>
          <p className="auth-aside-copy">{vendor
            ? 'Bring your shop to a marketplace built for independent businesses across Bangladesh.'
            : 'Sign in to keep your favourite local finds and your shopping journey together.'}</p>
          <div className="auth-aside-note"><span className="auth-note-dot" /> Thoughtfully local. Made for Bangladesh.</div>
        </aside>

        <section className="auth-card" aria-labelledby="auth-heading">
          <p className="auth-card-eyebrow">{eyebrow}</p>
          <h2 id="auth-heading">{title}</h2>
          <p className="auth-card-description">{description}</p>
          {children}
        </section>
      </div>

      <footer className="auth-footer">© 2026 Brazzars <span>·</span> Good things, found close to home.</footer>
    </main>
  );
}
