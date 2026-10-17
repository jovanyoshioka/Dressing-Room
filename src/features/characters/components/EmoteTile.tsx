import { useEffect, useState } from "react";
import type { ThumbnailRenderer } from "../previews/ThumbnailRenderer";

interface EmoteTileProps {
  id: string;
  name: string;
  owned: boolean;
  locked: boolean;
  renderer: ThumbnailRenderer;
  selected: boolean;
  onSelect: () => void;
  onError: (error: unknown) => void;
}

export function EmoteTile({
  id,
  name,
  owned,
  locked,
  renderer,
  selected,
  onSelect,
  onError,
}: EmoteTileProps) {
  const [image, setImage] = useState("");

  useEffect(() => {
    let active = true;

    renderer
      .emote(id)
      .then((renderedImage) => {
        if (active) {
          setImage(renderedImage);
        }
      })
      .catch((error) => {
        if (active) {
          onError(error);
        }
      });

    return () => {
      active = false;
    };
  }, [id, renderer, onError]);

  return (
    <button
      className={`skin-tile emote-tile ${owned ? "owned" : ""} ${selected ? "selected" : ""}`}
      aria-label={name}
      aria-pressed={selected}
      title={name}
      onClick={onSelect}
    >
      {image && <img src={image} alt="" />}

      {locked && (
        <img
          className="skin-lock"
          src={`${import.meta.env.BASE_URL}assets/ui/lock.svg`}
          alt="Locked"
        />
      )}
    </button>
  );
}
