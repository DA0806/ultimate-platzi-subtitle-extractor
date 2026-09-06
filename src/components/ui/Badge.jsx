const variants = {
  default: 'border-primary/20 bg-primary/10 text-primary',
  success: 'border-success/20 bg-success/10 text-success',
  warning: 'border-warning/20 bg-warning/10 text-warning',
  destructive: 'border-destructive/20 bg-destructive/10 text-destructive',
  muted: 'border-border bg-muted text-muted-foreground',
};

export const Badge = ({ variant = 'default', className = '', children, ...spanProps }) => (
  <span
    {...spanProps}
    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-state ease-motion ${variants[variant] || variants.default} ${className}`}
  >
    {children}
  </span>
);

export default Badge;
