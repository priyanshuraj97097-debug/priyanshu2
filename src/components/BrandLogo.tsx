import logo from "@/assets/priyanshu-logo.png.asset.json";

export function BrandLogo({ className = "size-8" }: { className?: string }) {
  return (
    <img
      src={logo.url}
      alt="Priyanshu 2.0 logo"
      width={512}
      height={512}
      loading="eager"
      decoding="async"
      className={`${className} shrink-0 rounded-full object-cover ring-1 ring-border/60`}
    />
  );
}
