import { ArrowRight, ArrowUpRight, Compass, Store } from 'lucide-react';
import { Link } from 'react-router-dom';
import CustomerLayout from '../components/marketplace/CustomerLayout.jsx';
import { CategoryCard, ProductGrid, RequestState, SectionHeading, ShopCard } from '../components/marketplace/MarketplaceUI.jsx';
import useMarketplaceRequest from '../hooks/useMarketplaceRequest.js';

function DataSection({ title, eyebrow, to, state, items, renderItem, emptyTitle, emptyMessage }) {
  return <section className="market-section">
    <SectionHeading eyebrow={eyebrow} title={title} to={to} />
    <RequestState loading={state.loading} error={state.error} empty={!state.loading && !state.error && items.length === 0} emptyTitle={emptyTitle} emptyMessage={emptyMessage} />
    {!state.loading && !state.error && items.length > 0 && renderItem(items)}
  </section>;
}

export default function HomePage() {
  const categoriesState = useMarketplaceRequest('/categories', { limit: 8 });
  const productsState = useMarketplaceRequest('/products', { sort: 'price_asc', limit: 8 });
  const shopsState = useMarketplaceRequest('/shops', { limit: 4 });
  const arrivalState = useMarketplaceRequest('/products', { sort: 'newest', limit: 4 });
  const categories = categoriesState.data?.categories ?? [];
  const products = productsState.data?.products ?? [];
  const shops = shopsState.data?.shops ?? [];
  const arrivals = arrivalState.data?.products ?? [];

  return <CustomerLayout>
    <main>
      <section className="market-hero">
        <div className="market-hero-copy">
          <p className="market-eyebrow"><Compass size={14} /> DISCOVER BRAZZARS</p>
          <h1>Find your next<br /><span>favourite thing.</span></h1>
          <p className="market-hero-description">Explore products and independent shops from across Bangladesh.</p>
          <div className="market-hero-actions"><Link className="button-primary" to="/search?q=">Explore products <ArrowRight size={17} /></Link><Link className="button-secondary" to="/shops">Meet the shops</Link></div>
          <div className="market-hero-note"><span className="hero-note-mark"><Store size={17} /></span><span><strong>One marketplace, many local shops</strong><small>Browse what sellers have listed on Brazzars.</small></span></div>
        </div>
        <div className="market-hero-art" aria-label="Abstract Brazzars marketplace illustration" role="img">
          <div className="hero-art-orbit orbit-one" /><div className="hero-art-orbit orbit-two" />
          <div className="hero-art-tile hero-art-tile-blue"><Store size={27} /><span>local shops</span></div>
          <div className="hero-art-tile hero-art-tile-orange"><Compass size={26} /><span>new finds</span></div>
          <div className="hero-art-center"><span className="hero-center-dot" /><span className="hero-center-word">b.</span></div>
          <span className="hero-art-caption">Discover something different</span>
        </div>
      </section>

      <div className="market-trust-strip"><span>Browse by category</span><span className="trust-divider" /><span>Explore independent shops</span><span className="trust-divider" /><span>Find products listed on Brazzars</span></div>

      <div className="market-content-wrap">
        <DataSection title="Browse categories" eyebrow="START EXPLORING" to="/#categories" state={categoriesState} items={categories} emptyTitle="Categories are on their way" emptyMessage="There are no active categories to show yet." renderItem={(items) => <div className="category-grid" id="categories">{items.map((category) => <CategoryCard key={category.id ?? category.slug} category={category} />)}</div>} />
        <DataSection title="Products to explore" eyebrow="FROM THE MARKETPLACE" to="/search?q=" state={productsState} items={products} emptyTitle="No products to show yet" emptyMessage="Products will appear here when they are available from approved shops." renderItem={(items) => <ProductGrid products={items} />} />
        <DataSection title="Shops on Brazzars" eyebrow="MEET THE SELLERS" to="/shops" state={shopsState} items={shops} emptyTitle="No public shops to show yet" emptyMessage="Approved shops will appear here when they are available." renderItem={(items) => <div className="shop-grid">{items.map((shop) => <ShopCard key={shop.slug} shop={shop} />)}</div>} />
        <DataSection title="New arrivals" eyebrow="RECENTLY LISTED" to="/search?q=" state={arrivalState} items={arrivals} emptyTitle="No new arrivals yet" emptyMessage="Newly listed products will appear here." renderItem={(items) => <ProductGrid products={items} />} />
      </div>

      <section className="seller-promo"><div className="seller-promo-icon"><Store size={25} /></div><div><p className="market-eyebrow">FOR INDEPENDENT SELLERS</p><h2>Bring your shop to Brazzars.</h2><p>Start a seller application and introduce your shop to marketplace shoppers.</p></div><Link to="/vendor/register" className="button-light">Open a seller account <ArrowUpRight size={17} /></Link></section>
    </main>
  </CustomerLayout>;
}
