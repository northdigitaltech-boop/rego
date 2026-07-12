import Image from "next/image";

import logoSrc from "../home/logo.png";

export function BrandLogo({ className }: { className?: string }) {
  return (
    <Image
      src={logoSrc}
      alt="Rego — Book. Explore. Experience."
      className={className}
      priority
      quality={100}
      unoptimized
    />
  );
}
