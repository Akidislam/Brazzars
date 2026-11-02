import { Link } from 'react-router-dom';
import { ArrowLeft, Construction } from 'lucide-react';
import CustomerLayout from '../components/marketplace/CustomerLayout.jsx';

export default function CheckoutPlaceholderPage() {
  return <CustomerLayout><main className="listing-page checkout-placeholder-page">
    <Link className="back-link" to="/cart"><ArrowLeft size={16} /> Back to cart</Link>
    <section className="checkout-placeholder"><span><Construction size={28} /></span><p className="market-eyebrow">NEXT MILESTONE</p><h1>Checkout is coming next.</h1><p>Your cart is saved. Checkout, delivery options, and payment will be added in a later milestone.</p><Link className="button-primary" to="/cart">Return to cart</Link></section>
  </main></CustomerLayout>;
}
