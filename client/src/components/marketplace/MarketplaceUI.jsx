import { ArrowRight, ArrowUpRight, Image as ImageIcon, LoaderCircle, SearchX, Store } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useCart } from '../../context/CartContext.jsx';

export function SectionHeading({ eyebrow, title, to, linkLabel = 'View all' }) {
  return <div className="market-section-heading"><div><p className="market-eyebrow">{eyebrow}</p><h2>{title}</h2></div>{to && <Link className="market-view-link" to={to}>{linkLabel}<ArrowRight size={16} /></Link>}</div>;
}

export function RequestState({ loading, error, empty, emptyTitle = 'Nothing to show yet', emptyMessage = 'Check back later as the marketplace grows.' }) {
  if (loading) return <div className="market-state" role="status"><LoaderCircle className="spin" size={24} /><span>Loading marketplace…</span></div>;
  if (error) return <div className="market-state market-state-error" role="alert"><span>{error}</span></div>;
  if (empty) return <div className="market-state market-state-empty"><SearchX size={25} /><strong>{emptyTitle}</strong><span>{emptyMessage}</span></div>;
  return null;
}

function ProductImage({ images, name }) {
  const image = Array.isArray(images) ? images.find((item) => typeof item === 'string' ? item.trim() : item?.url?.trim()) : null;
  const src = typeof image === 'string' ? image : image?.url;
  return <div className="product-image">{src ? <img src={src} alt={name} loading="lazy" /> : <div className="product-image-empty" aria-label="No product image available"><ImageIcon size={27} /><span>Image coming soon</span></div>}</div>;
}

export function ProductCard({ product }) {
  const location = useLocation();
  const { addProduct, addingSlugs } = useCart();
  const [cartMessage, setCartMessage] = useState('');
  const shop = product.shop && typeof product.shop === 'object' ? product.shop : null;
  const category = product.category && typeof product.category === 'object' ? product.category : null;
  const price = Number.isFinite(Number(product.price)) ? new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 2 }).format(Number(product.price)) : null;
  const outOfStock = Number(product.stock) < 1;
  const adding = addingSlugs.includes(product.slug);

  async function handleAdd() {
    setCartMessage('');
    try {
      await addProduct(product.slug);
      setCartMessage('Added to cart.');
    } catch (error) {
      setCartMessage(error.message);
    }
  }

  return <article className="product-card">
    <Link to={`/products/${encodeURIComponent(product.slug)}`} state={{ from: `${location.pathname}${location.search}` }} className="product-card-link" aria-label={`View ${product.name}`}>
      <ProductImage images={product.images} name={product.name ?? 'Product'} />
      <div className="product-card-copy">
        {category?.name && <span className="product-category-label">{category.name}</span>}
        <h3>{product.name}</h3>
        {price && <p className="product-price">{price}</p>}
        {shop?.shopName && <p className="product-shop-name"><Store size={13} />{shop.shopName}</p>}
      </div>
    </Link>
    <div className="product-card-action"><button type="button" className="add-to-cart-button" onClick={handleAdd} disabled={adding || outOfStock}>
      {outOfStock ? 'Out of stock' : adding ? 'Adding…' : 'Add to cart'}
    </button>{cartMessage && <span className="cart-action-message" role="status">{cartMessage}</span>}</div>
  </article>;
}

export function ProductGrid({ products }) {
  return <div className="product-grid">{products.map((product) => <ProductCard key={product.id ?? product.slug} product={product} />)}</div>;
}

export function CategoryCard({ category }) {
  return <Link className="category-card" to={`/categories/${encodeURIComponent(category.slug)}`}>
    <span className="category-card-icon">{category.image ? <img src={category.image} alt="" loading="lazy" /> : <Store size={25} />}</span>
    <span className="category-card-name">{category.name}</span><ArrowUpRight size={17} className="category-card-arrow" />
  </Link>;
}

export function ShopCard({ shop }) {
  const location = shop.address ? [shop.address.city, shop.address.district, shop.address.country].filter(Boolean).join(', ') : '';
  return <Link className="shop-card" to={`/shops/${encodeURIComponent(shop.slug)}`}>
    <span className="shop-card-avatar">{shop.logo ? <img src={shop.logo} alt="" loading="lazy" /> : <Store size={23} />}</span>
    <span className="shop-card-copy"><strong>{shop.shopName}</strong>{location && <small>{location}</small>}</span><ArrowRight size={17} />
  </Link>;
}

export function Pagination({ pagination, onPage }) {
  if (!pagination || pagination.pages <= 1) return null;
  return <div className="market-pagination" aria-label="Pagination"><button type="button" disabled={pagination.page <= 1} onClick={() => onPage(pagination.page - 1)}>Previous</button><span>Page {pagination.page} of {pagination.pages}</span><button type="button" disabled={pagination.page >= pagination.pages} onClick={() => onPage(pagination.page + 1)}>Next</button></div>;
}
