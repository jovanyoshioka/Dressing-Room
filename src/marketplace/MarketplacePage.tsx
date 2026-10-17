import type { ReactNode } from "react";
import { dressingRoomPackUrl } from "../features/characters/skins/PackNavigation";

const asset = (name: string) => `${import.meta.env.BASE_URL}assets/marketplace/${name}`;

function Icon({ name, className = "" }: { name: "down" | "right" | "search" | "person" | "hanger" | "star"; className?: string }) {
  return <svg className={`market-icon ${className}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false" shapeRendering="crispEdges">
    {name === "down" && <path fill="currentColor" d="M4 8h2v2h2v2h2v2h4v-2h2v-2h2V8h2v4h-2v2h-2v2h-2v2h-4v-2H8v-2H6v-2H4z" />}
    {name === "right" && <path fill="currentColor" d="M8 3h3v3h3v3h3v6h-3v3h-3v3H8v-4h3v-3h3v-4h-3V7H8z" />}
    {name === "search" && <path fill="currentColor" d="M6 2h8v2h3v3h2v8h-3v3h-3v1H6v-2H3v-3H1V7h2V4h3zm0 3v2H4v7h3v2h6v-2h3V7h-3V5zm11 11h3v3h3v4h-4v-3h-3v-3z" />}
    {name === "person" && <path fill="currentColor" d="M7 2h10v2h2v10h-2V5H7v9H5V4h2zm0 12h3v3H7v3H4v2H1v-4h3v-3h3zm7 0h3v1h3v3h3v4h-3v-2h-3v-3h-3z" />}
    {name === "hanger" && <path fill="currentColor" d="M10 1h5v2h2v4h-3v3h3v2h3v3h3v8H1v-8h3v-3h3v-2h4V7h3V4h-4v2H7V3h3zm0 12H7v3H4v4h16v-4h-3v-3h-3v-2h-4z" />}
    {name === "star" && <>
      <path fill="#000" d="M10 0h4v5h3v3h7v5h-4v3h-2v8l-6-4-6 4v-8H4v-3H0V8h7V5h3z" />
      <path fill="#8b6019" d="M10 3h4v5h3v2h5v2h-4v4h-2v5l-4-3-4 3v-5H6v-4H2v-2h5V8h3z" />
      <path fill="#ffc42b" d="M10 3h3v6h6v3h-4v7l-4-3-3 3v-7H4v-2h6z" />
      <path fill="#fff3b0" d="M10 3h2v7H5v2H3v-2h5V8h2zm-2 9h2v5H8z" />
    </>}
  </svg>;
}

function Inactive({ children, className = "", label }: { children: ReactNode; className?: string; label?: string }) {
  return <button type="button" disabled className={className} aria-label={label}>{children}</button>;
}

function Coin({ className = "" }: { className?: string }) {
  return <img className={`minecoin ${className}`} src={asset("minecoin.png")} alt="" />;
}

export function MarketplacePage() {
  return <div className="marketplace-page">
    <header className="market-header">
      <Inactive className="brand" label="Minecraft home"><img src={asset("minecraft-logo.svg")} alt="Minecraft" /></Inactive>
      <nav className="market-nav" aria-label="Main navigation">
        {["Games", "Shop", "Explore", "Community", "Support"].map((label) => <Inactive key={label}>{label}{label !== "Support" && <Icon name="down" />}</Inactive>)}
      </nav>
      <div className="market-tools">
        <Inactive className="buy-now">Buy now <Icon name="right" /></Inactive>
        <Inactive className="search-tool" label="Search"><Icon name="search" /><Icon name="down" /></Inactive>
        <Inactive className="account-tool"><Icon name="person" />Account<Icon name="down" /></Inactive>
      </div>
    </header>
    <Inactive className="dungeons-promo" label="Brave the unknown. Get Minecraft Dungeons II">
      <span className="promo-copy"><span>Brave the unknown</span><strong>Get Minecraft Dungeons II</strong><Icon name="right" /></span>
    </Inactive>
    <main className="market-main">
      <div className="market-toolbar">
        <nav className="market-breadcrumbs" aria-label="Breadcrumb">
          {["MARKETPLACE", "SKIN PACKS", "MINECRAFT"].map((label) => <span key={label}><Inactive>{label}</Inactive><span className="breadcrumb-separator" aria-hidden="true">|</span></span>)}
          <span className="current-crumb" aria-current="page">DUNGEONS II HERO SKIN PACK</span>
        </nav>
        <div className="minecoin-wallet" aria-label="Minecoins balance: 0">
          <span className="wallet-label">Minecoins</span><Coin /><span className="wallet-balance pixel-label">0</span>
          <Inactive className="add-minecoins" label="Add Minecoins"><span aria-hidden="true">+</span></Inactive>
        </div>
      </div>
      <div className="market-product">
        <div className="pack-art-frame"><img className="pack-art" src={asset("dungeons-ii-hero-skin-pack.png")} alt="Minecraft Dungeons II Hero Skin Pack: heroes with swords, shields and bows in a torchlit dungeon" /></div>
        <section className="pack-purchase" aria-labelledby="pack-title">
          <div className="pack-details">
            <h1 id="pack-title">Dungeons II Hero<br />Skin Pack</h1>
            <div className="pack-byline"><span className="by">by</span> <Inactive className="creator-name">Minecraft</Inactive>
              <span className="pack-rating" role="img" aria-label="4.5 out of 5 stars"><span className="rating-stars">{[0, 1, 2, 3, 4].map((n) => <span className={`rating-star ${n === 4 ? "half-star" : ""}`} key={n}><Icon name="star" /></span>)}</span></span>
              <span className="rating-count">3819</span>
            </div>
            <div className="pack-rule" />
            <div className="skin-count"><Icon name="hanger" />21 Skins</div>
            <div className="pack-rule lower-rule" />
            <div className="pack-price"><Coin /><span className="pixel-label">FREE</span></div>
          </div>
          <Inactive className="get-pack">Get this for <Coin /> Free <Icon name="right" /></Inactive>
          <button type="button" className="try-on" onClick={() => window.location.assign(dressingRoomPackUrl(import.meta.env.BASE_URL))}>
            TRY IT ON <Icon name="right" />
          </button>
        </section>
      </div>
    </main>
  </div>;
}
