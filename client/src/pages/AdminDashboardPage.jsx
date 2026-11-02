import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, ClipboardList, PackageCheck, ShieldCheck, Store, Tags } from 'lucide-react';
import AdminLayout from '../layouts/AdminLayout.jsx';

const upcoming = ['Customer Management', 'Vendor Payouts', 'Settings'];

export default function AdminDashboardPage() {
  const location = useLocation();
  const available = [
    { title: 'Order Management', description: 'Review customer orders, vendor fulfillment, and marketplace order status.', to: '/admin/orders', action: 'Open order management', Icon: ClipboardList },
    { title: 'Category Management', description: 'Create and maintain the categories customers use to discover products.', to: '/admin/categories', action: 'Manage categories', Icon: Tags },
    { title: 'Product Management', description: 'Review product submissions and manage marketplace product visibility.', to: '/admin/products', action: 'Manage products', Icon: PackageCheck },
    { title: 'Vendor Management', description: 'Review vendor applications and manage approved shop visibility.', to: '/admin/vendors', action: 'Manage vendors', Icon: Store },
  ];
  return <AdminLayout><main className="admin-dashboard-page">
    {location.state?.notice && <div className="admin-dashboard-notice" role="status">{location.state.notice}</div>}
    <div className="admin-page-heading"><p>MARKETPLACE OPERATIONS</p><h1>Dashboard overview</h1><span>Welcome to your Brazzars administration workspace.</span></div>
    <section className="admin-overview-banner"><div className="admin-overview-icon"><ShieldCheck size={22} /></div><div><span>ADMIN WORKSPACE</span><h2>Operations, in one place.</h2><p>Order, category, and vendor management are ready. Other areas will become available as their workflows are implemented.</p></div></section>
    <section className="admin-dashboard-sections">
      {available.map(({ title, description, to, action, Icon }) => <article className="admin-ready-card" key={title}><div className="admin-ready-card-icon"><Icon size={20} /></div><span className="admin-ready-tag">AVAILABLE</span><h2>{title}</h2><p>{description}</p><Link to={to}>{action} <ArrowRight size={16} /></Link></article>)}
      <article className="admin-upcoming-card"><p className="admin-upcoming-label">IN DEVELOPMENT</p><h2>More workspace areas</h2><div>{upcoming.map((item) => <p key={item}><span>{item}</span><small>Not implemented yet</small></p>)}</div></article>
    </section>
  </main></AdminLayout>;
}
