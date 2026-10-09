import type {
  BodyType,
  Manifest,
  SkinMetadata,
  SkinRecord,
  PackDefinition,
  SkinDefinition,
  Diagnostic,
  ImportOptions,
  ImportResult,
  JsonObject,
} from "../types";
import JSZip from "jszip";
import { GEOMETRY_TYPES } from "../models/ModelLibrary";

const LIMITS = {
  archive: 20 * 1024 * 1024,
  expanded: 50 * 1024 * 1024,
  entries: 2048,
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const version = (v: unknown): v is [number, number, number] =>
  Array.isArray(v) &&
  v.length === 3 &&
  v.every((n) => Number.isInteger(n) && n >= 0);

export class ImportError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function fail(code: string, message: string): never {
  throw new ImportError(code, message);
}

export function safePath(path: string) {
  if (
    typeof path !== "string" ||
    !path ||
    path.includes("\\") ||
    path.startsWith("/") ||
    path.split("/").some((x) => x === ".." || x === "." || x === "") ||
    /[:\u0000-\u001f]/.test(path)
  )
    fail("invalid_path", `Unsafe pack path: ${path}`);
  return path;
}

export async function decodePNG(blob: Blob): Promise<ImageBitmap> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (
    bytes.length < 24 ||
    ![137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b) ||
    String.fromCharCode(...bytes.slice(12, 16)) !== "IHDR"
  )
    fail("unreadable_png", "Texture is not a PNG.");
  const d = new DataView(bytes.buffer),
    width = d.getUint32(16),
    height = d.getUint32(20);
  if (!(
    (width === 64 && [32, 64].includes(height)) ||
    (width === 128 && height === 128)
  ))
    fail(
      "invalid_dimensions",
      "Skin must be a 64 × 32, 64 × 64 or 128 × 128 PNG.",
    );
  try {
    return await createImageBitmap(blob);
  } catch {
    fail("unreadable_png", "Could not decode PNG pixels.");
  }
}

function archiveEntries(buffer: ArrayBuffer) {
  const d = new DataView(buffer);
  let end = -1;
  for (let p = d.byteLength - 22; p >= Math.max(0, d.byteLength - 65557); p--)
    if (d.getUint32(p, true) === 0x06054b50) {
      end = p;
      break;
    }

  if (end < 0) fail("invalid_archive", "ZIP directory is missing.");
  if (d.getUint16(end + 4, true) || d.getUint16(end + 6, true))
    fail("unsupported_archive", "Split archives are unsupported.");
  const count = d.getUint16(end + 10, true),
    offset = d.getUint32(end + 16, true);
  if (count === 65535 || offset === 0xffffffff)
    fail("unsupported_archive", "ZIP64 archives are unsupported.");
  if (count > LIMITS.entries)
    fail("archive_limit", "Too many archive entries.");
  let p = offset,
    total = 0;
  const paths = new Set();
  for (let i = 0; i < count; i++) {
    if (p + 46 > d.byteLength || d.getUint32(p, true) !== 0x02014b50)
      fail("invalid_archive", "Invalid ZIP directory.");
    if (d.getUint16(p + 8, true) & 1)
      fail("encrypted_archive", "Encrypted archives are unsupported.");
    total += d.getUint32(p + 24, true);
    if (total > LIMITS.expanded)
      fail("archive_limit", "Expanded archive exceeds 50 MiB.");
    const n = d.getUint16(p + 28, true),
      e = d.getUint16(p + 30, true),
      c = d.getUint16(p + 32, true);
    const name = new TextDecoder().decode(new Uint8Array(buffer, p + 46, n));
    safePath(name.endsWith("/") ? name.slice(0, -1) : name);
    if (paths.has(name))
      fail("duplicate_path", `Duplicate archive path: ${name}`);
    paths.add(name);
    p += 46 + n + e + c;
  }
}

async function fingerprint(files: Map<string, Blob>) {
  const chunks: string[] = [];
  for (const [path, blob] of [...files].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const hash = new Uint8Array(
      await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()),
    );
    chunks.push(
      path +
        ":" +
        [...hash].map((x) => x.toString(16).padStart(2, "0")).join(""),
    );
  }

  return [
    ...new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(chunks.join("\n")),
      ),
    ),
  ]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}

export class SkinPackImporter {
  async archive(
    blob: Blob,
    options: ImportOptions = {},
  ): Promise<ImportResult> {
    if (blob.size > LIMITS.archive)
      fail("archive_limit", "Archive exceeds 20 MiB.");
    const buffer = await blob.arrayBuffer();
    archiveEntries(buffer);
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(buffer, { checkCRC32: true });
    } catch (e) {
      fail("invalid_archive", `Cannot read ZIP: ${errorDetails(e).message}`);
    }

    const files = new Map<string, Blob>();
    let size = 0;
    for (const entry of Object.values(zip.files)) {
      if (entry.dir) continue;
      const path = safePath(
          (entry as JSZip.JSZipObject & { unsafeOriginalName?: string })
            .unsafeOriginalName || entry.name,
        ),
        bytes = await entry.async("uint8array");
      size += bytes.length;
      if (size > LIMITS.expanded)
        fail("archive_limit", "Expanded archive exceeds 50 MiB.");
      files.set(path, new Blob([new Uint8Array(bytes)]));
    }

    return this.files(files, options);
  }

  async folder(
    fileList: File[],
    options: ImportOptions = {},
  ): Promise<ImportResult> {
    const files = new Map<string, Blob>();
    let bytes = 0;
    for (const file of fileList) {
      const path = safePath(file.webkitRelativePath || file.name);
      if (files.has(path)) fail("duplicate_path", `Duplicate file: ${path}`);
      files.set(path, file);
      bytes += file.size;
    }

    if (files.size > LIMITS.entries || bytes > LIMITS.expanded)
      fail("archive_limit", "Folder exceeds import limits.");

    return this.files(files, options);
  }

  async files(
    files: Map<string, Blob>,
    { root, locale = "en_US" }: ImportOptions = {},
  ): Promise<ImportResult> {
    const roots = [...files.keys()]
      .filter((p) => p === "manifest.json" || p.endsWith("/manifest.json"))
      .map((p) => p.slice(0, -13))
      .filter((prefix) => files.has(prefix + "skins.json"));
    if (!roots.length)
      fail(
        "missing_pack_files",
        "Pack root must contain manifest.json and skins.json.",
      );
    if (root === undefined && roots.length > 1) return { roots };
    root = root ?? roots[0];
    if (!roots.includes(root))
      fail("invalid_root", "Choose a listed pack root.");
    const packFiles = new Map(
      [...files]
        .filter(([p]) => p.startsWith(root!))
        .map(([p, b]) => [p.slice(root!.length), b]),
    );

    const parse = async (name: string): Promise<unknown> => {
      try {
        return JSON.parse(await packFiles.get(name)!.text());
      } catch {
        fail("invalid_json", `Invalid ${name}.`);
      }
    };

    const rawManifest = await parse("manifest.json"),
      rawMetadata = await parse("skins.json");
    if (!isObject(rawManifest))
      fail("invalid_manifest", "Manifest must be an object.");
    if (rawManifest.format_version !== 1 && rawManifest.format_version !== 2)
      fail("unsupported_manifest", "Supported manifest versions: 1 and 2.");
    const h = rawManifest.header,
      modules = rawManifest.modules;
    if (
      !isObject(h) ||
      typeof h.name !== "string" ||
      typeof h.uuid !== "string" ||
      !UUID.test(h.uuid) ||
      !version(h.version) ||
      !Array.isArray(modules) ||
      !modules.length
    )
      fail(
        "invalid_manifest",
        "Manifest requires a name, valid UUIDs, versions, and skin_pack module.",
      );
    const ids = [h.uuid.toLowerCase()];
    for (const m of modules) {
      if (!isObject(m))
        fail("invalid_manifest", "Each module must be an object.");
      if (m.type !== "skin_pack")
        fail("unsupported_module", "Only skin_pack modules are supported.");
      if (
        typeof m.uuid !== "string" ||
        !UUID.test(m.uuid) ||
        !version(m.version) ||
        ids.includes(m.uuid.toLowerCase())
      )
        fail("invalid_manifest", "Module UUIDs must be valid and distinct.");
      ids.push(m.uuid.toLowerCase());
    }

    if (
      !isObject(rawMetadata) ||
      typeof rawMetadata.serialize_name !== "string" ||
      typeof rawMetadata.localization_name !== "string" ||
      !Array.isArray(rawMetadata.skins) ||
      !rawMetadata.skins.length
    )
      fail("invalid_skin_definitions", "Invalid pack skin definitions.");
    // These assertions follow the runtime checks; unknown optional metadata stays intact.
    const manifest = rawManifest as Manifest,
      sourceMetadata = rawMetadata as SkinMetadata;
    const localization: Record<string, Record<string, string>> = {};

    for (const [path, blob] of packFiles)
      if (/^texts\/[^/]+\.lang$/.test(path)) {
        const values: Record<string, string> = Object.create(null);
        for (const line of (await blob.text()).split(/\r?\n/)) {
          if (!line.trim() || line.trimStart().startsWith("#")) continue;
          const i = line.indexOf("=");
          if (i >= 0) values[line.slice(0, i).trim()] = line.slice(i + 1);
        }

        localization[path.slice(6, -5)] = values;
      }

    const resolve = (keys: string[], fallback: string) => {
      for (const l of [...new Set([locale, "en_US"])])
        for (const key of keys)
          if (localization[l]?.[key] !== undefined) return localization[l][key];
      return fallback;
    };

    const namespaces = [
      ...new Set([
        sourceMetadata.localization_name,
        sourceMetadata.serialize_name,
      ]),
    ];
    const id = h.uuid.toLowerCase(),
      revision = h.version.join(".");
    const pack: PackDefinition = {
      id,
      version: h.version,
      name: resolve(
        [...namespaces.map((n) => "skinpack." + n), h.name],
        h.name,
      ),
      manifest,
      sourceMetadata,
      localization,
      files: packFiles,
      fingerprint: await fingerprint(packFiles),
      languages: null,
    };

    const diagnostics: Diagnostic[] = [];
    if (packFiles.has("texts/languages.json")) {
      try {
        pack.languages = await parse("texts/languages.json");
        if (!Array.isArray(pack.languages)) throw Error();
      } catch {
        diagnostics.push({
          scope: "pack",
          code: "invalid_languages",
          message: "Ignored invalid optional languages.json.",
        });
      }
    }

    const skins: SkinDefinition[] = [];
    for (const [index, rawRecord] of sourceMetadata.skins.entries()) {
      try {
        if (
          !isObject(rawRecord) ||
          ![
            rawRecord.localization_name,
            rawRecord.geometry,
            rawRecord.texture,
          ].every((x) => typeof x === "string" && x.length) ||
          !(rawRecord.type === "free" || rawRecord.type === "paid")
        )
          fail(
            "invalid_skin_record",
            "Skin requires name, geometry, texture, and free/paid type.",
          );
        const record = rawRecord as SkinRecord;
        const bodyType = Object.hasOwn(GEOMETRY_TYPES, record.geometry)
          ? GEOMETRY_TYPES[record.geometry as keyof typeof GEOMETRY_TYPES]
          : null;
        if (!bodyType)
          fail(
            "unsupported_geometry",
            `Unsupported geometry: ${record.geometry}`,
          );
        safePath(record.texture);
        const blob = packFiles.get(record.texture);
        if (!blob) fail("missing_texture", `Missing ${record.texture}.`);
        const image = await decodePNG(blob);
        skins.push({
          id: `${id}@${revision}:${index}`,
          packId: id,
          index,
          name: resolve(
            namespaces.map((n) => `skin.${n}.${record.localization_name}`),
            record.localization_name,
          ),
          sourceRecord: record,
          blob,
          image,
          geometry: record.geometry,
          bodyType,
          sourceArmLayout: image.height === 32 ? "classic" : bodyType,
        });
      } catch (e) {
        diagnostics.push({
          scope: "skin",
          index,
          code: errorDetails(e).code || "invalid_skin_record",
          message: errorDetails(e).message,
        });
      }
    }

    return { pack, skins, diagnostics };
  }

  async png(
    blob: Blob & { name?: string },
    sourceArmLayout: BodyType,
  ): Promise<SkinDefinition> {
    if (!["classic", "slim"].includes(sourceArmLayout))
      fail("invalid_layout", "Choose classic or slim source layout.");
    const image = await decodePNG(blob),
      layout = image.height === 32 ? "classic" : sourceArmLayout;
    const id =
      "png:" +
      (await fingerprint(new Map([["skin.png", blob]]))) +
      ":" +
      layout;
    return {
      id,
      name: blob.name?.replace(/\.png$/i, "") || "Imported PNG",
      blob,
      image,
      bodyType: layout,
      sourceArmLayout: layout,
      geometry:
        layout === "slim"
          ? "geometry.humanoid.customSlim"
          : "geometry.humanoid.custom",
      sourceRecord: null,
      packId: null,
    };
  }
}

function isObject(value: unknown): value is JsonObject {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function errorDetails(error: unknown): {
  code?: string;
  message: string;
} {
  if (error instanceof ImportError)
    return { code: error.code, message: error.message };
  if (error instanceof Error) return { message: error.message };
  return { message: String(error) };
}
