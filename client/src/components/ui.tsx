import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  const look = {
    primary: 'bg-moss text-white hover:bg-moss-dark',
    ghost: 'bg-transparent text-ink hover:bg-black/5',
    danger: 'bg-clay text-white hover:bg-clay/90',
  }[variant];
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50 ${look} ${className}`}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-clay">{hint}</span> : null}
    </label>
  );
}

const control =
  'w-full rounded-md border border-line bg-card px-3 py-2 text-sm outline-none focus:border-moss';

export function TextInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${control} ${className}`} {...props} />;
}

export function TextArea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${control} ${className}`} {...props} />;
}

export function SelectInput({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${control} ${className}`} {...props} />;
}

export function Notice({ children }: { children: ReactNode }) {
  return <p className="rounded-md bg-clay/10 px-3 py-2 text-sm text-clay">{children}</p>;
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return <p className="text-sm text-muted">{label}…</p>;
}
