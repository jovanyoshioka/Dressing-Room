export const ENVIRONMENTS = [
  "overworld",
  "sift",
  "cave",
  "nether",
  "end",
  "none",
] as const;

export function backdropUrl(base: string, name: string): string {
  return `${base}assets/environments/${name}.webp`;
}

/** Warm the image/decode cache after paint, without competing with startup assets. */
export function preloadBackdrops(base: string) {
  let cancelled = false;
  let frame = 0;
  let timer = 0;
  let idle = 0;

  const images: HTMLImageElement[] = [];

  const warm = async () => {
    // Sequential low-priority requests avoid flooding slower connections.
    for (const name of ENVIRONMENTS) {
      if (cancelled) break;
      if (name === "none") continue;

      const image = new Image();
      image.decoding = "async";
      image.fetchPriority = "low";
      images.push(image); // Keep decoded images alive while the preview is mounted.
      image.src = backdropUrl(base, name);

      try {
        await image.decode();
      } catch {
        // A failed warm-up must not block the UI or remaining images.
      }
    }
  };

  frame = window.requestAnimationFrame(() => {
    // A second frame gives the first committed UI a chance to paint.
    frame = window.requestAnimationFrame(() => {
      if (typeof window.requestIdleCallback === "function") {
        idle = window.requestIdleCallback(
          () => {
            void warm();
          },
          { timeout: 1500 },
        );
      } else {
        timer = window.setTimeout(() => {
          void warm();
        }, 0);
      }
    });
  });

  return () => {
    cancelled = true;
    window.cancelAnimationFrame(frame);
    window.clearTimeout(timer);

    if (idle) {
      window.cancelIdleCallback(idle);
    }

    images.forEach((image) => {
      image.src = "";
    });
    images.length = 0;
  };
}
