import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import CategoryPage from './pages/CategoryPage.jsx';
import ShopsPage from './pages/ShopsPage.jsx';
import ShopPage from './pages/ShopPage.jsx';
import SearchPage from './pages/SearchPage.jsx';
import ProductPage from './pages/ProductPage.jsx';
import CartPage from './pages/CartPage.jsx';
import CheckoutPage from './pages/CheckoutPage.jsx';
import OrderPages from './pages/OrderPages.jsx';
import VendorOrdersPage from './pages/VendorOrdersPage.jsx';
import AdminOrdersPage from './pages/AdminOrdersPage.jsx';
import AdminLoginPage from './pages/AdminLoginPage.jsx';
import AdminChangePasswordPage from './pages/AdminChangePasswordPage.jsx';
import AdminDashboardPage from './pages/AdminDashboardPage.jsx';
import AdminCategoriesPage from './pages/AdminCategoriesPage.jsx';
import AdminVendorsPage from './pages/AdminVendorsPage.jsx';
import AdminProductsPage from './pages/AdminProductsPage.jsx';
import ProtectedRoute, { GuestOnlyRoute } from './routes/ProtectedRoute.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/categories/:slug" element={<CategoryPage />} />
      <Route path="/shops" element={<ShopsPage />} />
      <Route path="/shops/:slug" element={<ShopPage />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/products/:slug" element={<ProductPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/cart" element={<CartPage />} />
      <Route element={<ProtectedRoute allowedRoles={['customer']} />}>
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/orders/confirmation/:id" element={<OrderPages mode="confirmation" />} />
        <Route path="/account/orders" element={<OrderPages mode="list" />} />
        <Route path="/account/orders/:id" element={<OrderPages mode="detail" />} />
      </Route>
      <Route element={<GuestOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/vendor/login" element={<LoginPage accountType="vendor" />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/vendor/register" element={<RegisterPage accountType="vendor" />} />
      </Route>
      <Route element={<ProtectedRoute allowedRoles={['customer']} />}>
        <Route path="/account" element={<DashboardPage role="customer" />} />
      </Route>
      <Route element={<ProtectedRoute allowedRoles={['vendor']} loginPath="/vendor/login" />}>
        <Route path="/vendor/dashboard" element={<VendorOrdersPage />} />
        <Route path="/vendor/orders" element={<VendorOrdersPage />} />
        <Route path="/vendor/orders/:id" element={<VendorOrdersPage mode="detail" />} />
      </Route>
      <Route element={<ProtectedRoute allowedRoles={['admin']} allowPasswordChange />}>
        <Route path="/admin/change-password" element={<AdminChangePasswordPage />} />
      </Route>
      <Route element={<ProtectedRoute allowedRoles={['admin']} loginPath="/admin/login" />}>
        <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
        <Route path="/admin/orders" element={<AdminOrdersPage />} />
        <Route path="/admin/orders/:id" element={<AdminOrdersPage mode="detail" />} />
        <Route path="/admin/categories" element={<AdminCategoriesPage />} />
        <Route path="/admin/products" element={<AdminProductsPage />} />
        <Route path="/admin/products/:id" element={<AdminProductsPage mode="detail" />} />
        <Route path="/admin/vendors" element={<AdminVendorsPage />} />
        <Route path="/admin/vendors/:id" element={<AdminVendorsPage mode="detail" />} />
      </Route>
      <Route path="*" element={<HomePage />} />
    </Routes>
  );
}
