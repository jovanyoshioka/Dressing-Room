import type { CatalogPrice } from "../skins/CatalogPricing";

export function GetThisButton({ price }: { price: CatalogPrice }) {
  if (price === null) return null;

  const accessibleLabel = `Get this for ${price === "FREE" ? "free" : `${price} Minecoins`}`;

  return (
    <button
      type="button"
      className="catalog-purchase"
      disabled
      aria-label={accessibleLabel}
    >
      <span>GET THIS FOR</span>

      <img
        src={`${import.meta.env.BASE_URL}assets/ui/minecoin.png`}
        alt=""
      />

      <span>{price}</span>

      <svg
        viewBox="0 0 12 20"
        aria-hidden="true"
        focusable="false"
        shapeRendering="crispEdges"
      >
        <path
          fill="currentColor"
          d="M2 0h3v3H2zm3 3h3v3H5zm3 3h3v3H8zm1 3h3v2H9zm-1 2h3v3H8zm-3 3h3v3H5zm-3 3h3v3H2z"
        />
      </svg>
    </button>
  );
}
