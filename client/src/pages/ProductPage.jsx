import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, Store } from 'lucide-react';
import CustomerLayout from '../components/marketplace/CustomerLayout.jsx';
import { RequestState } from '../components/marketplace/MarketplaceUI.jsx';
import useMarketplaceRequest from '../hooks/useMarketplaceRequest.js';

export default function ProductPage() {
  const { slug } = useParams();
  const location = useLocation();
  const productState = useMarketplaceRequest(`/products/${encodeURIComponent(slug)}`);
  const product = productState.data?.product;
  const image = Array.isArray(product?.images) ? product.images.find((item) => typeof item === 'string' ? item : item?.url) : null;
  const imageUrl = typeof image === 'string' ? image : image?.url;
  const price = product && Number.isFinite(Number(product.price)) ? new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 2 }).format(Number(product.price)) : '';
  const shop = product?.shop && typeof product.shop === 'object' ? product.shop : null;
  const category = product?.category && typeof product.category === 'object' ? product.category : null;
  return <CustomerLayout><main className="listing-page product-detail-page">
    <Link className="back-link" to={location.state?.from ?? '/search?q='}><ArrowLeft size={16} /> Back to products</Link>
    <RequestState loading={productState.loading} error={productState.error} empty={!productState.loading && !productState.error && !product} emptyTitle="Product not found" emptyMessage="This product may no longer be available." />
    {product && <article className="product-detail">
      <div className="product-detail-image">{imageUrl ? <img src={imageUrl} alt={product.name} /> : <div className="product-image-empty"><span>Image not available</span></div>}</div>
      <div className="product-detail-copy">{category?.name && <p className="market-eyebrow">{category.name}</p>}<h1>{product.name}</h1>{price && <p className="product-detail-price">{price}</p>}{product.description && <p className="product-description">{product.description}</p>}{shop?.slug && <Link className="detail-shop-link" to={`/shops/${encodeURIComponent(shop.slug)}`}><Store size={17} /> Visit {shop.shopName ?? 'shop'} <span aria-hidden="true">→</span></Link>}</div>
    </article>}
  </main></CustomerLayout>;
}
