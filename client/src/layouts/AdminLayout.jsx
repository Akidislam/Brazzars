import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Activity, ArrowUpRight, Boxes, CreditCard, LayoutDashboard, LogOut, Menu, PackageCheck, Settings, ShieldCheck, Store, Users, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const navigation = [
  { label: 'Dashboard Overview', to: '/admin/dashboard', icon: LayoutDashboard, ready: true },
  { label: 'Order Management', to: '/admin/orders', icon: PackageCheck, ready: true },
  { label: 'Product Approval', icon: Boxes },
  { label: 'Vendor Management', icon: Store },
  { label: 'Customer Management', icon: Users },
  { label: 'Categories', icon: Activity },
  { label: 'Vendor Payouts', icon: CreditCard },
  { label: 'Settings', icon: Settings },
];

export default function AdminLayout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  function signOut() { logout(); navigate('/admin/login', { replace: true }); }

  return <div className="admin-shell">
    <aside className={`admin-sidebar ${menuOpen ? 'admin-sidebar-open' : ''}`}>
      <div className="admin-brand"><span className="admin-brand-mark">B</span><span>brazzars<span>.</span><small>ADMIN CONSOLE</small></span></div>
      <div className="admin-sidebar-label">WORKSPACE</div>
      <nav aria-label="Admin navigation" className="admin-nav">
        {navigation.map(({ label, to, icon: Icon, ready }) => ready
          ? <NavLink key={label} to={to} end={to === '/admin/dashboard'} onClick={() => setMenuOpen(false)} className={({ isActive }) => `admin-nav-link ${isActive ? 'admin-nav-active' : ''}`}><Icon size={17} /><span>{label}</span></NavLink>
          : <div className="admin-nav-link admin-nav-disabled" key={label} aria-disabled="true" title="This area is not implemented yet"><Icon size={17} /><span>{label}</span><small>Soon</small></div>)}
      </nav>
      <div className="admin-sidebar-bottom"><div className="admin-profile"><span>{user?.name?.slice(0, 1)?.toUpperCase() || 'A'}</span><div><strong>{user?.name || 'Administrator'}</strong><small>{user?.email}</small></div></div><button className="admin-logout" onClick={signOut}><LogOut size={16} /> Sign out</button></div>
    </aside>
    {menuOpen && <button className="admin-mobile-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    <div className="admin-main"><header className="admin-topbar"><button className="admin-menu-toggle" onClick={() => setMenuOpen((open) => !open)} aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button><div><span className="admin-topbar-kicker">BRAZZARS · ADMIN</span><strong>Marketplace operations</strong></div><span className="admin-secure"><ShieldCheck size={15} /> Secure workspace</span></header><div className="admin-content">{children}</div><footer className="admin-footer">Brazzars Admin Console <span>·</span> Bangladesh marketplace operations <ArrowUpRight size={13} /></footer></div>
  </div>;
}
