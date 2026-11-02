import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const dashboardCopy = {
  customer: { eyebrow: 'YOUR BRAZZARS', title: 'Your account', description: 'Your Brazzars account is ready. Shopping and order tools will appear here as they are added.' },
  vendor: { eyebrow: 'SELLER SPACE', title: 'Your seller dashboard', description: 'Your shop application is submitted. Seller tools are being prepared for the next Brazzars milestone.' },
  admin: { eyebrow: 'MARKETPLACE ADMIN', title: 'Admin workspace', description: 'Admin tools will be added here. Admin accounts are provisioned privately; there is no public admin registration.' },
};

export default function DashboardPage({ role }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const copy = dashboardCopy[role];

  function handleLogout() {
    logout();
    navigate('/', { replace: true });
  }

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <Link className="auth-brand" to="/">brazzars<span>.</span></Link>
        <button type="button" className="dashboard-logout" onClick={handleLogout}>Log out</button>
      </header>
      <section className="dashboard-card">
        <p className="auth-card-eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        {location.state?.notice && <div className="auth-notice auth-notice-success" role="status">{location.state.notice}</div>}
        {role === 'vendor' && location.state?.shopStatus === 'pending' && <p className="dashboard-pending">Shop status: <strong>Pending Admin approval</strong>. Your shop is not publicly listed yet.</p>}
        <p className="dashboard-description">{copy.description}</p>
        <div className="dashboard-profile">
          <span className="dashboard-avatar" aria-hidden="true">{user?.name?.slice(0, 1)?.toUpperCase() ?? 'B'}</span>
          <div><strong>{user?.name}</strong><span>{user?.email}</span></div>
          <span className="dashboard-role">{user?.role}</span>
        </div>
        <Link className="dashboard-home-link" to="/">Return to marketplace</Link>
        {role === 'customer' && <Link className="dashboard-home-link" to="/account/orders">My Orders</Link>}
        {role === 'admin' && <Link className="dashboard-home-link" to="/admin/orders">Manage marketplace orders</Link>}
      </section>
    </main>
  );
}
