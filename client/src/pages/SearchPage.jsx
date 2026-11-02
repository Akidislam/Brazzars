import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import CustomerLayout from '../components/marketplace/CustomerLayout.jsx';
import { Pagination, ProductGrid, RequestState } from '../components/marketplace/MarketplaceUI.jsx';
import useMarketplaceRequest from '../hooks/useMarketplaceRequest.js';

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const [value, setValue] = useState(query);
  const page = searchParams.get('page') ?? '1';
  useEffect(() => setValue(query), [query]);
  const productsState = useMarketplaceRequest('/products', { ...(query ? { search: query } : {}), page, limit: 20, sort: 'newest' });
  const products = productsState.data?.products ?? [];

  function submit(event) {
    event.preventDefault();
    const next = {};
    if (value.trim()) next.q = value.trim();
    setSearchParams(next);
  }

  function changePage(nextPage) {
    const next = {};
    if (query) next.q = query;
    next.page = String(nextPage);
    setSearchParams(next);
  }

  return <CustomerLayout><main className="listing-page">
    <div className="listing-heading"><p className="market-eyebrow">SEARCH BRAZZARS</p><h1>{query ? `Results for “${query}”` : 'Explore products'}</h1><p>Search products listed by public shops.</p></div>
    <form className="results-search" role="search" onSubmit={submit}><input aria-label="Search marketplace" value={value} onChange={(event) => setValue(event.target.value)} placeholder="What are you looking for?" /><button className="button-primary" type="submit">Search</button></form>
    <RequestState loading={productsState.loading} error={productsState.error} empty={!productsState.loading && !productsState.error && products.length === 0} emptyTitle={query ? 'No matching products' : 'No public products yet'} emptyMessage={query ? 'Try a different search term.' : 'Products will appear here when approved shops list them.'} />
    {!productsState.loading && !productsState.error && products.length > 0 && <ProductGrid products={products} />}
    <Pagination pagination={productsState.data?.pagination} onPage={changePage} />
  </main></CustomerLayout>;
}
