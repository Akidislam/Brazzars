import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, ClipboardList, ShieldCheck } from 'lucide-react';
import AdminLayout from '../layouts/AdminLayout.jsx';

const upcoming = ['Product Approval', 'Vendor Management', 'Customer Management', 'Categories', 'Vendor Payouts', 'Settings'];

export default function AdminDashboardPage() {
  const location = useLocation();
  return <AdminLayout><main className="admin-dashboard-page">{location.state?.notice && <div className="admin-dashboard-notice" role="status">{location.state.notice}</div>}<div className="admin-page-heading"><p>MARKETPLACE OPERATIONS</p><h1>Dashboard overview</h1><span>Welcome to your Brazzars administration workspace.</span></div><section className="admin-overview-banner"><div className="admin-overview-icon"><ShieldCheck size={22} /></div><div><span>ADMIN WORKSPACE</span><h2>Operations, in one place.</h2><p>Order management is ready. Other areas will become available as their workflows are implemented.</p></div></section><section className="admin-dashboard-sections"><div className="admin-ready-card"><div className="admin-ready-card-icon"><ClipboardList size={20} /></div><span className="admin-ready-tag">AVAILABLE</span><h2>Order Management</h2><p>Review customer orders, vendor fulfillment, and order status across the marketplace.</p><Link to="/admin/orders">Open order management <ArrowRight size={16} /></Link></div><div className="admin-upcoming-card"><p className="admin-upcoming-label">IN DEVELOPMENT</p><h2>More workspace areas</h2><div>{upcoming.map((item) => <p key={item}><span>{item}</span><small>Not implemented yet</small></p>)}</div></div></section></main></AdminLayout>;
}
