import type {
  StudioRuntime,
  SkinDefinition,
} from "./features/characters/types";
import { errorDetails } from "./features/characters/skins/SkinPackImporter";
import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { createRuntime } from "./features/characters/runtime";
import { SkinTile } from "./features/characters/components/SkinTile";
import { PlayerPreview } from "./features/characters/components/PlayerPreview";
import { ThumbnailRenderer } from "./features/characters/previews/ThumbnailRenderer";

export function App() {
  // --- Application State ---
  const [runtime, setRuntime] = useState<StudioRuntime | null>(null);
  const [, refresh] = useState(0);
  const [message, setMessage] = useState({ text: "", error: false });
  const [loading, setLoading] = useState("Loading characters…");
  const [busy, setBusy] = useState(false);

  // --- UI State ---
  const [packId, setPackId] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [tab] = useState(2);
  const [expanded, setExpanded] = useState(false);
  const [thumbnails, setThumbnails] = useState<ThumbnailRenderer | null>(null);
  const [envIndex, setEnvIndex] = useState(0);
  const envs = ["overworld", "sift", "cave", "nether", "end", "none"];

  // --- DOM References ---
  const pngInput = useRef<HTMLInputElement>(null);
  const skinPanel = useRef<HTMLElement>(null);
  const room = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const element = room.current!;
    // Keep controls sized to their normal grid tracks when panels expand.

    const resize = () => {
      const columns = getComputedStyle(element).gridTemplateColumns.split(" ");
      const railWidth = parseFloat(columns[0]);
      if (Number.isFinite(railWidth))
        element.style.setProperty("--rail-button-width", `${railWidth - 4}px`);
      const width = parseFloat(columns[columns.length - 1]);
      if (Number.isFinite(width))
        element.style.setProperty(
          "--preview-button-size",
          `${Math.max(46, width * 0.09)}px`,
        );
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const mounted = useRef(true);
  const navigation = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);

  const notify = useCallback((text: string, error = false) => {
    if (mounted.current) setMessage({ text, error });
  }, []);

  const onError = useCallback(
    (e: unknown) => {
      const detail = errorDetails(e);
      notify(`${detail.code || "error"}: ${detail.message}`, true);
    },
    [notify],
  );

  useEffect(() => {
    let active = true,
      created: StudioRuntime | undefined;
    mounted.current = true;
    createRuntime()
      .then((r) => {
        created = r;
        if (!active) {
          r.dispose();
          return;
        }

        r.onChange = () => refresh((n) => n + 1);
        setRuntime(r);
        setLoading("");
        setThumbnails(new ThumbnailRenderer(r));
      })
      .catch((e) => {
        if (active) {
          setLoading("Unable to start: " + e.message);
          onError(e);
        }
      });

    return () => {
      active = false;
      mounted.current = false;
      created?.dispose();
    };
  }, [notify, onError]);

  useEffect(() => {
    if (runtime && import.meta.env.DEV) {
      window.studio = {
        ...runtime,
        ready: runtime.views.every((v) => v.renderer),
      };

      const timer = setInterval(() => {
        window.studio!.ready = runtime.views.every((v) => v.renderer);
      }, 50);
      return () => {
        clearInterval(timer);
        delete window.studio;
      };
    }
  }, [runtime]);

  useEffect(() => () => thumbnails?.dispose(), [thumbnails]);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (menu) {
          setMenu(false);
          menuButton.current?.focus();
          return;
        }
        setPackId(null);
        setExpanded(false);
        setMenu(false);
      }
    };

    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [menu]);

  useEffect(() => {
    skinPanel.current?.scrollTo(0, 0);
  }, [packId]);

  useEffect(() => {
    if (!message.text || message.error) return;
    const timer = setTimeout(
      () => setMessage({ text: "", error: false }),
      4000,
    );
    return () => clearTimeout(timer);
  }, [message]);

  const selectSkin = async (skin: SkinDefinition) => {
    if (!runtime) return;
    try {
      await runtime.views[0].change(skin, null);
      notify("");
    } catch (error) {
      onError(error);
    }
  };

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file || !runtime) return;
    setBusy(true);
    try {
      const skin = runtime.catalog.addPNG(await runtime.importer.png(file, "classic"));
      runtime.onChange();
      await selectSkin(skin);
      setPackId(null);
      notify(`Imported ${skin.name}.`);
    } catch (error) {
      onError(error);
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  useEffect(() => {
    if (!menu) return;
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const buttons = navigation.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
      if (!buttons?.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    menuButton.current?.focus();
    window.addEventListener("keydown", trapFocus);
    return () => window.removeEventListener("keydown", trapFocus);
  }, [menu]);

  const player = runtime?.views[0];
  const skins = runtime ? [...runtime.catalog.skins.values()] : [];
  const packs = runtime ? [...runtime.catalog.packs.values()] : [];
  const groups = [
    { id: "custom", name: "Imported Skins", owned: true,
      skins: skins.filter((s) => !s.packId) },
    ...packs.map((p) => ({
      id: p.id,
      name: p.name,
      owned: p.sourceMetadata.serialize_name !== "elemental_knights",
      skins: skins.filter((s) => s.packId === p.id),
    })),
  ];
  const openPack = groups.find((p) => p.id === packId);
  const isCustom = player?.character.skin.packId === null;
  const isImport = player?.character.skin.isImportPlaceholder === true;

  const tile = (skin: SkinDefinition) =>
    thumbnails && (
      <SkinTile
        key={skin.id}
        skin={skin}
        locked={packs.find((p) => p.id === skin.packId)?.sourceMetadata.serialize_name === "elemental_knights"}
        renderer={thumbnails}
        selected={player?.character.skin.id === skin.id}
        onSelect={() => {
          void selectSkin(skin);
        }}
        onError={onError}
      />
    );
  return (
    <main
      ref={room}
      className={`dressing-room ${expanded ? "preview-expanded" : ""}`}
    >
      {menu && <button className="navigation-backdrop" aria-label="Close navigation" tabIndex={-1}
        onClick={() => { setMenu(false); menuButton.current?.focus(); }} />}
      <nav ref={navigation} id="dressing-navigation" className={`tab-rail ${menu ? "menu-open" : ""}`} aria-label="Dressing room tabs">
        <button
          ref={menuButton}
          className="menu-button"
          aria-label="Navigation menu"
          aria-controls="dressing-navigation"
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
        >
          <span />
          <span />
          <span />
        </button>
        {["My Characters", "Character Creator", "Classic Skins", "Emotes", "Capes"].map(
          (name, i) => (
            <button
              key={name}
              className={`rail-tab ${tab === i ? "active" : ""}`}
              aria-label={name}
              aria-pressed={tab === i}
              aria-current={tab === i ? "page" : undefined}
              disabled={tab !== i}
              onClick={() => { setMenu(false); menuButton.current?.focus(); }}
            >
              <img
                className="tab-icon"
                src={`${import.meta.env.BASE_URL}assets/ui/tab-${i}.png`}
                alt=""
              />
              {menu && <span className="navigation-label">{name}</span>}
            </button>
          ),
        )}
        {menu && <button className="marketplace-button" disabled>Go to Marketplace</button>}
      </nav>
      <section ref={skinPanel} className="skin-panel" aria-label="Skin packs" inert={menu}>
        {openPack ? (
          <>
            <button
              className="pack-back"
              onClick={() => setPackId(null)}
              aria-label="Back to all skin packs"
            >
              ← {openPack.name}
            </button>
            <div className="skin-grid" aria-label={openPack.name}>
              {openPack.skins.map(tile)}
            </div>
          </>
        ) : (
          <div className="pack-rows">
            {[{ name: "Owned Skins", owned: true }, { name: "Get More", owned: false }].map((section) => (
              <section className="catalog-section" key={section.name} aria-label={section.name}>
                <h2 className="catalog-heading">{section.name}</h2>
                {groups.filter((pack) => pack.owned === section.owned).map((pack) => (
                  <section className={`skin-pack ${pack.id === "custom" ? "imported-skins" : ""}`} key={pack.id}>
                    {pack.id !== "custom" && <h3>{pack.name}</h3>}
                    <div className="skin-row">
                      {pack.skins.slice(0, pack.id === "custom" ? 4 : 5).map(tile)}
                      {pack.skins.length > (pack.id === "custom" ? 4 : 5) && (
                        <button className="overflow-tile" aria-label={`Show all ${pack.name} skins`}
                          onClick={() => setPackId(pack.id)}>
                          <span>+{pack.skins.length - (pack.id === "custom" ? 4 : 5)}</span>
                        </button>
                      )}
                    </div>
                  </section>
                ))}
              </section>
            ))}
          </div>
        )}
        {loading && (
          <p className="loading" role="status">
            {loading}
          </p>
        )}
      </section>
      <section className="character-panel" aria-label="Current player" inert={menu}>
        <div className="player-stage">
          <div
            className={`preview-backdrop ${envs[envIndex] !== "none" ? "has-image" : ""}`}
            aria-hidden="true"
            style={
              envs[envIndex] !== "none"
                ? {
                    backgroundImage: `url(${import.meta.env.BASE_URL}assets/environments/${envs[envIndex]}.png)`,
                    backgroundSize: "cover",
                    backgroundPosition: "center center",
                    backgroundColor: "transparent",
                  }
                : undefined
            }
          />
          {runtime && player && (
            <PlayerPreview runtime={runtime} view={player} tracking />
          )}
          <button
            className="expand-button minecraft-button"
            aria-label={expanded ? "Restore preview size" : "Expand preview"}
            aria-pressed={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            <img
              className="expand-icon"
              src={`${import.meta.env.BASE_URL}assets/ui/${expanded ? "minimize" : "expand"}.svg`}
              alt=""
            />
          </button>
          <button
            className="env-button minecraft-button"
            aria-label="Change environment"
            onClick={() => setEnvIndex((envIndex + 1) % envs.length)}
          >
            <img
              className="expand-icon"
              src={`${import.meta.env.BASE_URL}assets/ui/picture.svg`}
              alt=""
            />
          </button>
        </div>
        <section
          className="skin-information"
          aria-label="Selected skin information"
        >
          <header>
            <h1 title={player?.character.skin.name}>{player?.character.skin.name}</h1>
            {!isCustom && <span>{groups.find((p) => p.skins.some((s) => s.id === player?.character.skin.id))?.name}</span>}
          </header>
          <div className="information-content">
            <p className={isImport ? "import-guidance" : "information-spacer"} aria-hidden={!isImport}>
              <img src={`${import.meta.env.BASE_URL}assets/ui/light-bulb.svg`} alt="" />
              <span>Import a png (64x32, 64x64, or 128x128) from your device to use as your skin. This will not sync between devices or games.</span>
            </p>
            {isCustom && <button
              className="choose-skin minecraft-button"
              disabled={!runtime || busy}
              onClick={() => pngInput.current?.click()}
            >Choose New Skin</button>}
          </div>

        </section>
      </section>
      <input
        ref={pngInput}
        id="png-upload"
        className="hidden-upload"
        type="file"
        accept="image/png"
        disabled={!runtime || busy}
        onChange={upload}
      />
      {message.text && (
        <p className={`message ${message.error ? "error" : ""}`} role="status">
          {message.text}
        </p>
      )}
    </main>
  );
}
