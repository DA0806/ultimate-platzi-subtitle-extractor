export const Progress = ({ value = 0, className = '', indicatorClassName = '', ...divProps }) => {
  const numericValue = Number(value);
  const clampedValue = Number.isFinite(numericValue)
    ? Math.min(100, Math.max(0, numericValue))
    : 0;

  return (
    <div
      {...divProps}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clampedValue}
      className={`relative h-2 w-full overflow-hidden rounded-full bg-muted ${className}`}
    >
      <div
        className={`h-full rounded-full bg-primary transition-[width,opacity] duration-state ease-motion ${indicatorClassName}`}
        style={{ width: `${clampedValue}%` }}
      />
    </div>
  );
};

export default Progress;
