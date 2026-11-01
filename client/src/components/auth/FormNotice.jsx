export default function FormNotice({ type = 'error', children }) {
  if (!children) return null;
  return <div className={`auth-notice auth-notice-${type}`} role={type === 'error' ? 'alert' : 'status'}>{children}</div>;
}
