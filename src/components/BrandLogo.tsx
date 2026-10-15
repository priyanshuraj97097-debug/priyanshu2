export function BrandLogo({ className = "size-8" }: { className?: string }) {
  return (
    <img
      src="/priyanshu-logo.png"
      alt="Priyanshu 2.0 logo"
      width={512}
      height={512}
      loading="eager"
      decoding="async"
      className={`${className} shrink-0 rounded-full object-cover ring-1 ring-border/60`}
    />
  );
}
