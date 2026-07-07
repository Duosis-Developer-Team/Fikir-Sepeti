import Image from "next/image";

type BrandIconProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
  priority?: boolean;
};

// Kare brand icon (sepet + fikir ikonları). Koyu #181818 badge — uygulamanın
// koyu zeminine oturunca ikon "yüzer" gibi görünür, açık yüzeyde yuvarlak tile olur.
const sizeClasses: Record<NonNullable<BrandIconProps["size"]>, string> = {
  sm: "h-8 w-8",
  md: "h-14 w-14",
  lg: "h-24 w-24",
};

export function BrandIcon({ size = "md", className = "", priority = false }: BrandIconProps) {
  return (
    <Image
      src="/brand/fikirsepeti-icon.png"
      alt="FikirSepeti"
      width={512}
      height={512}
      priority={priority}
      className={`${sizeClasses[size]} rounded-2xl object-contain ${className}`}
    />
  );
}
