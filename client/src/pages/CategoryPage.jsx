import { useParams, useSearchParams } from 'react-router-dom';
import CustomerLayout from '../components/marketplace/CustomerLayout.jsx';
import { Pagination, ProductGrid, RequestState } from '../components/marketplace/MarketplaceUI.jsx';
import useMarketplaceRequest from '../hooks/useMarketplaceRequest.js';

export default function CategoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { slug } = useParams();
  const page = searchParams.get('page') ?? '1';
  const categoryState = useMarketplaceRequest(`/categories/${encodeURIComponent(slug)}`);
  const productsState = useMarketplaceRequest(`/categories/${encodeURIComponent(slug)}/products`, { page, limit: 20, sort: 'newest' });
  const category = categoryState.data?.category;
  const products = productsState.data?.products ?? [];
  const pagination = productsState.data?.pagination;

  return <CustomerLayout><main className="listing-page">
    <div className="listing-heading"><p className="market-eyebrow">BROWSE BY CATEGORY</p><h1>{category?.name ?? (categoryState.loading ? 'Loading category…' : 'Category products')}</h1><p>Products currently available in this category.</p></div>
    {categoryState.error && <p className="inline-error" role="alert">{categoryState.error}</p>}
    <RequestState loading={productsState.loading} error={productsState.error} empty={!productsState.loading && !productsState.error && products.length === 0} emptyTitle="No products in this category yet" emptyMessage="Try another category or browse all shops." />
    {!productsState.loading && !productsState.error && products.length > 0 && <ProductGrid products={products} />}
    <Pagination pagination={pagination} onPage={(next) => setSearchParams({ page: String(next) })} />
  </main></CustomerLayout>;
}
