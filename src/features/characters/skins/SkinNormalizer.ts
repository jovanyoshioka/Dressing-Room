import type { BodyType, SkinDefinition } from "../types";

type Rect = [number, number, number, number];

function atlasRects(
  u: number,
  v: number,
  w: number,
  h: number,
  d: number,
): Rect[] {
  return [
    [u + d, v + d, w, h],
    [u + 2 * d + w, v + d, w, h],
    [u, v + d, d, h],
    [u + d + w, v + d, d, h],
    [u + d, v, w, d],
    [u + d + w, v, w, d],
  ];
}

function skinCanvas(size: number) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return c;
}

function copyRect(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  src: Rect,
  dest: Rect,
  mirror = false,
) {
  const [sx, sy, sw, sh] = src,
    [dx, dy, dw, dh] = dest;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (mirror) {
    ctx.translate(dx + dw, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, dw, dh);
  } else ctx.drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh);
  ctx.restore();
}

function normalizeSkin(
  image: ImageBitmap,
  sourceType: BodyType = "classic",
  targetType: BodyType = "classic",
) {
  if (!(
    (image.width === 64 && [32, 64].includes(image.height)) ||
    (image.width === 128 && image.height === 128)
  ))
    throw new Error("Use a 64 × 32, 64 × 64 or 128 × 128 PNG skin.");
  if (
    !["classic", "slim"].includes(sourceType) ||
    !["classic", "slim"].includes(targetType)
  )
    throw new Error("Unknown arm layout.");
  // UVs use a 64-unit atlas; preserve native texels at higher resolution.
  const size = image.width,
    scale = size / 64;
  const c = skinCanvas(size),
    ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = false;
  ctx.scale(scale, scale);
  ctx.drawImage(image, 0, 0, 64, image.height / scale);
  const legacy = image.height === 32;
  if (legacy) {
    sourceType = "classic";
    // Old fully opaque hat blocks mean "no hat", per the legacy skin convention.
    const hat = ctx.getImageData(32, 0, 32, 32);
    if (
      Array.from(hat.data)
        .filter((_, i) => i % 4 === 3)
        .every((a) => a === 255)
    ) {
      // Only the top 16 rows are hat faces; the arm occupies rows 16–31.
      ctx.clearRect(32, 0, 32, 16);
    }

    for (const [srcOrigin, destOrigin] of [
      [
        [40, 16],
        [32, 48],
      ],
      [
        [0, 16],
        [16, 48],
      ],
    ]) {
      const src = atlasRects(srcOrigin[0], srcOrigin[1], 4, 12, 4),
        dest = atlasRects(destOrigin[0], destOrigin[1], 4, 12, 4);
      // Front/back/top/bottom mirror; physical left/right side faces exchange.
      [0, 1, 3, 2, 4, 5].forEach((face, i) =>
        copyRect(ctx, image, src[face], dest[i], true),
      );
    }
  }
  // Minecraft base skin faces are opaque; overlay transparency is retained.
  const pixels = ctx.getImageData(0, 0, size, size);
  for (const [u, v, w, h, d] of [
    [0, 0, 8, 8, 8],
    [16, 16, 8, 12, 4],
    [40, 16, sourceType === "slim" ? 3 : 4, 12, 4],
    [32, 48, sourceType === "slim" ? 3 : 4, 12, 4],
    [0, 16, 4, 12, 4],
    [16, 48, 4, 12, 4],
  ]) {
    for (const [x, y, rw, rh] of atlasRects(u, v, w, h, d))
      for (let py = y * scale; py < (y + rh) * scale; py++)
        for (let px = x * scale; px < (x + rw) * scale; px++)
          pixels.data[(py * size + px) * 4 + 3] = 255;
  }

  ctx.putImageData(pixels, 0, 0);
  if (sourceType !== targetType) {
    const snapshot = skinCanvas(size);
    snapshot.getContext("2d")!.drawImage(c, 0, 0);
    const from = sourceType === "slim" ? 3 : 4,
      to = targetType === "slim" ? 3 : 4;
    for (const origin of [
      [40, 16],
      [32, 48],
      [40, 32],
      [48, 48],
    ]) {
      const src = atlasRects(origin[0], origin[1], from, 12, 4),
        dest = atlasRects(origin[0], origin[1], to, 12, 4);
      ctx.clearRect(origin[0], origin[1], 16, 16);
      src.forEach((rect, i) =>
        copyRect(ctx, snapshot, rect.map((n) => n * scale) as Rect, dest[i]),
      );
    }
  }

  return { canvas: c, legacy, sourceType, targetType };
}

export class SkinNormalizer {
  cache: Map<string, ReturnType<typeof normalizeSkin>>;

  constructor() {
    this.cache = new Map();
  }

  normalize(skin: SkinDefinition, target: BodyType) {
    const key = `${skin.id}:${skin.sourceArmLayout}:${target}`;
    if (!this.cache.has(key))
      this.cache.set(
        key,
        normalizeSkin(skin.image, skin.sourceArmLayout, target),
      );
    return this.cache.get(key)!;
  }

  invalidate(ids: string[]) {
    for (const key of this.cache.keys())
      if (ids.some((id) => key.startsWith(id + ":"))) this.cache.delete(key);
  }
}

export { normalizeSkin, atlasRects };
