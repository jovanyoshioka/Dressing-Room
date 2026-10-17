import type { PackDefinition } from "../types";
import { DUNGEONS_PACK } from "./PackNavigation";

export type CatalogPrice = number | "FREE" | null;

export function skinPackPrice(pack: PackDefinition | undefined): CatalogPrice {
  switch (pack?.sourceMetadata.serialize_name) {
    case DUNGEONS_PACK: return "FREE";
    case "elemental_knights": return 250;
    default: return null;
  }
}

export function emotePrice(id: string | null, owned: readonly string[]): CatalogPrice {
  return id && !owned.includes(id) ? 100 : null;
}
