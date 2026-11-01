import { useId, useState } from 'react';

export function FormField({ label, error, hint, className = '', as = 'input', ...inputProps }) {
  const generatedId = useId();
  const id = inputProps.id ?? generatedId;
  const messageId = `${id}-message`;

  return (
    <div className={`auth-field ${className}`}>
      <label className="auth-label" htmlFor={id}>{label}{inputProps.required && <span aria-hidden="true"> *</span>}</label>
      {as === 'textarea' ? (
        <textarea
          {...inputProps}
          id={id}
          aria-label={label}
          className={`auth-input auth-textarea ${error ? 'auth-input-error' : ''}`}
          aria-invalid={Boolean(error)}
          aria-describedby={error || hint ? messageId : undefined}
        />
      ) : (
        <input
          {...inputProps}
          id={id}
          aria-label={label}
          className={`auth-input ${error ? 'auth-input-error' : ''}`}
          aria-invalid={Boolean(error)}
          aria-describedby={error || hint ? messageId : undefined}
        />
      )}
      {(error || hint) && <p className={error ? 'auth-field-error' : 'auth-field-hint'} id={messageId}>{error || hint}</p>}
    </div>
  );
}

export function PasswordField({ label = 'Password', error, ...inputProps }) {
  const generatedId = useId();
  const id = inputProps.id ?? generatedId;
  const messageId = `${id}-message`;
  const [visible, setVisible] = useState(false);

  return (
    <div className="auth-field">
      <label className="auth-label" htmlFor={id}>{label}{inputProps.required && <span aria-hidden="true"> *</span>}</label>
      <div className="auth-password-wrap">
        <input
          {...inputProps}
          id={id}
          aria-label={label}
          type={visible ? 'text' : 'password'}
          className={`auth-input auth-password-input ${error ? 'auth-input-error' : ''}`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? messageId : undefined}
        />
        <button
          className="auth-password-toggle"
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
      {error && <p className="auth-field-error" id={messageId}>{error}</p>}
    </div>
  );
}

