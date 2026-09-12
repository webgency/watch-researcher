import { ASSET_BASE_PATH } from "@/lib/config";

/** Outlined artwork keeps the signature identical without loading a serif font. */
export default function BrandLogo() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${ASSET_BASE_PATH}/brand/vitrine-wordmark.svg`}
      alt="Vitrine"
      width={878}
      height={253}
      className="h-auto w-36 sm:w-40"
    />
  );
}
