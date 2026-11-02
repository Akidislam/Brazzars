import { Link, useParams, useSearchParams } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import CustomerLayout from '../components/marketplace/CustomerLayout.jsx';
import { Pagination, ProductGrid, RequestState } from '../components/marketplace/MarketplaceUI.jsx';
import useMarketplaceRequest from '../hooks/useMarketplaceRequest.js';

export default function ShopPage() {
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = searchParams.get('page') ?? '1';
  const shopState = useMarketplaceRequest(`/shops/${encodeURIComponent(slug)}`);
  const productsState = useMarketplaceRequest(`/shops/${encodeURIComponent(slug)}/products`, { page, limit: 20, sort: 'newest' });
  const shop = shopState.data?.shop;
  const location = shop?.address ? [shop.address.city, shop.address.district, shop.address.country].filter(Boolean).join(', ') : '';
  const products = productsState.data?.products ?? [];
  return <CustomerLayout><main className="listing-page">
    {shopState.loading ? <div className="shop-profile-skeleton" role="status">Loading shop…</div> : shopState.error ? <RequestState error={shopState.error} /> : shop && <section className="shop-profile"><span className="shop-profile-logo">{shop.logo ? <img src={shop.logo} alt="" /> : <span>{shop.shopName?.slice(0, 1)?.toUpperCase()}</span>}</span><div><p className="market-eyebrow">BRAZZARS SHOP</p><h1>{shop.shopName}</h1>{shop.description && <p>{shop.description}</p>}{location && <span className="shop-location"><MapPin size={15} />{location}</span>}</div></section>}
    <div className="shop-products-heading"><h2>Products from this shop</h2><Link to="/shops">Browse all shops</Link></div>
    <RequestState loading={productsState.loading} error={productsState.error} empty={!productsState.loading && !productsState.error && products.length === 0} emptyTitle="No products listed yet" emptyMessage="This shop does not have public products to show right now." />
    {!productsState.loading && !productsState.error && products.length > 0 && <ProductGrid products={products} />}
    <Pagination pagination={productsState.data?.pagination} onPage={(next) => setSearchParams({ page: String(next) })} />
  </main></CustomerLayout>;
}
