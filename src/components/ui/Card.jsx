export const Card = ({ className = '', children, ...divProps }) => (
  <div
    {...divProps}
    className={`rounded-lg border border-border bg-card p-[var(--card-padding)] text-card-foreground shadow-[var(--panel-shadow)] ${className}`}
  >
    {children}
  </div>
);

export default Card;
