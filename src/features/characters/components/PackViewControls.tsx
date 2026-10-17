export function PackViewControls({ origin, onCatalog, onMarketplace }: {
  origin: "marketplace" | "catalog";
  onCatalog: () => void;
  onMarketplace: () => void;
}) {
  return <div className="pack-view-controls" aria-label="Skin pack navigation">
    {origin === "marketplace" ? <>
      <button type="button" className="pack-back" onClick={onMarketplace}>← Marketplace</button>
      <button type="button" className="pack-back all-skin-packs" onClick={onCatalog}>All Skin Packs</button>
    </> : <button type="button" className="pack-back" onClick={onCatalog}>← All Skin Packs</button>}
  </div>;
}
