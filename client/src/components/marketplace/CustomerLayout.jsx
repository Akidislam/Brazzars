import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Menu, Search, ShoppingBag, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

const accountPaths = { customer: '/account', vendor: '/vendor/dashboard', admin: '/admin/dashboard' };

export default function CustomerLayout({ children }) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  function submitSearch(event) {
    event.preventDefault();
    const query = search.trim();
    if (query) navigate(`/search?q=${encodeURIComponent(query)}`);
    setMenuOpen(false);
  }

  const links = <>
    <NavLink to="/" end onClick={() => setMenuOpen(false)}>Home</NavLink>
    <Link to="/#categories" onClick={() => setMenuOpen(false)}>Categories</Link>
    <NavLink to="/shops" onClick={() => setMenuOpen(false)}>All shops</NavLink>
  </>;

  return <div className="marketplace-shell">
    <div className="marketplace-ribbon"><span>Discover independent shops across Bangladesh</span><Link to="/vendor/register">Have a shop? Join Brazzars <span aria-hidden="true">→</span></Link></div>
    <header className="marketplace-header">
      <div className="marketplace-header-main">
        <Link className="marketplace-brand" to="/" aria-label="Brazzars home">brazzars<span>.</span></Link>
        <form className="marketplace-search" role="search" onSubmit={submitSearch}>
          <Search size={19} aria-hidden="true" />
          <input aria-label="Search products" placeholder="Search products, shops and more" value={search} onChange={(event) => setSearch(event.target.value)} />
          <button type="submit">Search</button>
        </form>
        <div className="marketplace-actions">
          {user ? <>
            <Link className="account-link" to={accountPaths[user.role] ?? '/'}><span className="account-greeting">Hello, {user.name?.split(' ')[0] ?? 'there'}</span><strong>My account</strong></Link>
            <button className="header-text-button" type="button" onClick={() => { logout(); navigate('/'); }}>Log out</button>
          </> : <>
            <Link className="header-text-button" to="/login">Log in</Link>
            <Link className="header-register" to="/register">Create account</Link>
          </>}
          <span className="cart-placeholder" aria-label="Cart is not available yet"><ShoppingBag size={21} /><span>Cart</span></span>
        </div>
        <button className="mobile-menu-toggle" type="button" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={22} /> : <Menu size={22} />}</button>
      </div>
      <nav className="marketplace-nav" aria-label="Main navigation">{links}</nav>
      {menuOpen && <div className="marketplace-mobile-panel">
        <nav aria-label="Mobile navigation">{links}</nav>
        <form className="marketplace-search mobile-search" role="search" onSubmit={submitSearch}><Search size={18} aria-hidden="true" /><input aria-label="Search products on mobile" placeholder="Search Brazzars" value={search} onChange={(event) => setSearch(event.target.value)} /><button type="submit" aria-label="Submit search"><Search size={18} /></button></form>
        {user ? <Link to={accountPaths[user.role] ?? '/'} onClick={() => setMenuOpen(false)}>My account</Link> : <div className="mobile-auth-links"><Link to="/login" onClick={() => setMenuOpen(false)}>Log in</Link><Link to="/register" onClick={() => setMenuOpen(false)}>Create account</Link></div>}
      </div>}
    </header>
    {children}
    <footer className="marketplace-footer"><Link className="marketplace-brand" to="/">brazzars<span>.</span></Link><p>A marketplace for discovering independent shops across Bangladesh.</p><div><Link to="/shops">Browse shops</Link><Link to="/vendor/register">Become a seller</Link></div><small>© 2026 Brazzars</small></footer>
  </div>;
}
