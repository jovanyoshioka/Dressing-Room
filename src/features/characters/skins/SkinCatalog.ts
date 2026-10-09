import { ImportError } from "./SkinPackImporter";
import type {
  PackDefinition,
  SkinDefinition,
  PackImportResult,
} from "../types";

export class SkinCatalog {
  packs: Map<string, PackDefinition>;
  skins: Map<string, SkinDefinition>;

  constructor() {
    this.packs = new Map();
    this.skins = new Map();
  }

  add(
    result: PackImportResult,
    { replace = false }: { replace?: boolean } = {},
  ) {
    const { pack, skins } = result,
      previous = this.packs.get(pack.id);
    if (
      previous &&
      previous.version.join(".") === pack.version.join(".") &&
      previous.fingerprint === pack.fingerprint
    )
      return { reused: true };
    if (previous && !replace) {
      const error = new ImportError(
        "pack_conflict",
        "This pack UUID is already imported with different content or version. Choose Replace to update it.",
      );
      throw error;
    }

    const removed = [...this.skins.values()]
      .filter((s) => s.packId === pack.id)
      .map((s) => s.id);
    removed.forEach((id) => this.skins.delete(id));
    skins.forEach((s) => this.skins.set(s.id, s));
    this.packs.set(pack.id, pack);
    return { reused: false, removed };
  }

  addPNG(skin: SkinDefinition) {
    if (!this.skins.has(skin.id)) this.skins.set(skin.id, skin);
    else skin.image.close();
    return this.skins.get(skin.id)!;
  }

  get(id: string) {
    const s = this.skins.get(id);
    if (!s) throw new Error("Skin not found.");
    return s;
  }
}
