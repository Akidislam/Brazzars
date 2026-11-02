import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export const roleHomePaths = {
  customer: '/account',
  vendor: '/vendor/dashboard',
  admin: '/admin/dashboard',
};

function AuthLoading() {
  return <main className="auth-loading" role="status" aria-live="polite">Checking your Brazzars session…</main>;
}

export function GuestOnlyRoute({ children }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <AuthLoading />;
  if (user) return <Navigate to={roleHomePaths[user.role] ?? '/'} replace />;
  return children ?? <Outlet />;
}

export default function ProtectedRoute({ allowedRoles, loginPath = '/login', allowPasswordChange = false, children }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <AuthLoading />;
  if (!user) return <Navigate to={loginPath} state={{ from: location }} replace />;
  if (!allowedRoles.includes(user.role)) return <Navigate to={roleHomePaths[user.role] ?? '/'} replace />;
  if (user.role === 'admin' && user.mustChangePassword && !allowPasswordChange) {
    return <Navigate to="/admin/change-password" replace />;
  }

  return children ?? <Outlet />;
}
