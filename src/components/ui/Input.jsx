export const Input = ({ invalid = false, className = '', ...inputProps }) => (
  <input
    {...inputProps}
    aria-invalid={invalid ? true : inputProps['aria-invalid']}
    className={`flex min-h-[var(--control-height)] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground transition-colors duration-200 placeholder:text-muted-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 ${invalid ? 'border-destructive focus-visible:ring-destructive' : ''} ${className}`}
  />
);

export default Input;
