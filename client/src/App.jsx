import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ProtectedRoute, { GuestOnlyRoute } from './routes/ProtectedRoute.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
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
        <Route path="/vendor/dashboard" element={<DashboardPage role="vendor" />} />
      </Route>
      <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
        <Route path="/admin/dashboard" element={<DashboardPage role="admin" />} />
      </Route>
      <Route path="*" element={<HomePage />} />
    </Routes>
  );
}
