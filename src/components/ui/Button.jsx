import { Loader2 } from 'lucide-react';

const variants = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  outline: 'border border-input bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground',
  ghost: 'bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
};

const sizes = {
  default: 'h-11 rounded-md px-4 py-2',
  sm: 'h-11 rounded-md px-3 text-xs',
  lg: 'h-12 rounded-md px-8',
  icon: 'h-11 w-11 rounded-md p-0',
};

export const Button = ({
  variant = 'default',
  size = 'default',
  loading = false,
  className = '',
  children,
  ...buttonProps
}) => (
  <button
    {...buttonProps}
    type={buttonProps.type || 'button'}
    disabled={loading || buttonProps.disabled}
    aria-busy={loading || undefined}
    className={`inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap font-medium cursor-pointer transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-micro ease-motion hover:-translate-y-px active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant] || variants.default} ${sizes[size] || sizes.default} ${className}`}
  >
    {loading && <Loader2 className="h-4 w-4 animate-spin-slow" aria-hidden="true" />}
    {children}
  </button>
);

export default Button;
