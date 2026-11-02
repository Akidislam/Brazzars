import { useSearchParams } from 'react-router-dom';
import CustomerLayout from '../components/marketplace/CustomerLayout.jsx';
import { Pagination, RequestState, ShopCard } from '../components/marketplace/MarketplaceUI.jsx';
import useMarketplaceRequest from '../hooks/useMarketplaceRequest.js';

export default function ShopsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = searchParams.get('page') ?? '1';
  const shopsState = useMarketplaceRequest('/shops', { page, limit: 20 });
  const shops = shopsState.data?.shops ?? [];
  return <CustomerLayout><main className="listing-page">
    <div className="listing-heading"><p className="market-eyebrow">MEET THE SELLERS</p><h1>Shops on Brazzars</h1><p>Explore public shops listed in the marketplace.</p></div>
    <RequestState loading={shopsState.loading} error={shopsState.error} empty={!shopsState.loading && !shopsState.error && shops.length === 0} emptyTitle="No public shops yet" emptyMessage="Approved shops will appear here when they are available." />
    {!shopsState.loading && !shopsState.error && shops.length > 0 && <div className="shop-grid shop-grid-directory">{shops.map((shop) => <ShopCard key={shop.slug} shop={shop} />)}</div>}
    <Pagination pagination={shopsState.data?.pagination} onPage={(next) => setSearchParams({ page: String(next) })} />
  </main></CustomerLayout>;
}
