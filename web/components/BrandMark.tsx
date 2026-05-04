type Props = {
  size?: number;
  className?: string;
  title?: string;
};

export function BrandMark({ size = 24, className, title }: Props) {
  const labelled = Boolean(title);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={labelled ? "img" : undefined}
      aria-hidden={labelled ? undefined : true}
      aria-label={labelled ? title : undefined}
      className={className}
    >
      {labelled ? <title>{title}</title> : null}
      <defs>
        <linearGradient id="brandmark-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0c4a6e" />
          <stop offset="100%" stopColor="#082f49" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#brandmark-bg)" />
      <path
        d="M 6 22 Q 19 12 32 22 T 58 22"
        stroke="#fbbf24"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M 6 42 Q 19 32 32 42 T 58 42"
        stroke="#34d399"
        strokeWidth="4.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
