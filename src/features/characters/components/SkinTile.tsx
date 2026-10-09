import { useEffect, useRef, useState } from "react";
import type { SkinDefinition, ErrorHandler } from "../types";
import type { ThumbnailRenderer } from "../previews/ThumbnailRenderer";

export function SkinTile({
  skin,
  renderer,
  selected,
  onSelect,
  onError,
}: {
  skin: SkinDefinition;
  renderer: ThumbnailRenderer;
  selected: boolean;
  onSelect: () => void;
  onError: ErrorHandler;
}) {
  const [front, setFront] = useState(""),
    [hover, setHover] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let active = true;
    renderer
      .frames(skin)
      .then((f) => {
        if (active) setFront(f[0] || "");
      })
      .catch(onError);
    return () => {
      active = false;
    };
  }, [skin, renderer, onError]);

  useEffect(() => {
    if (!hover || !canvas.current) return;
    return renderer.animate(skin, canvas.current, onError);
  }, [hover, skin, renderer, onError]);
  return (
    <button
      className={`skin-tile ${selected ? "selected" : ""}`}
      title={skin.name}
      aria-label={skin.name}
      aria-pressed={selected}
      data-skin={skin.id}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      onClick={onSelect}
    >
      {front && (
        <img
          src={front}
          alt=""
          draggable={false}
          style={{ visibility: hover ? "hidden" : "visible" }}
        />
      )}
      <canvas
        ref={canvas}
        className="hover-preview"
        hidden={!hover}
        aria-hidden="true"
      />
    </button>
  );
}
