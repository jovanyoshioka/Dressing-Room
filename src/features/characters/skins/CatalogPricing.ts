import type { PackDefinition } from "../types";
import { DUNGEONS_PACK } from "./PackNavigation";

export type CatalogPrice = number | "FREE" | null;

/**
 * Returns the displayed pricing for skin packs in the dressing room.
 */
export function skinPackPrice(pack: PackDefinition | undefined): CatalogPrice {
  switch (pack?.sourceMetadata.serialize_name) {
    case DUNGEONS_PACK:
      return "FREE";

    case "elemental_knights":
      return 250;

    default:
      return null;
  }
}

/**
 * Returns the price for an emote when unowned, or null when owned or unselected.
 */
export function emotePrice(id: string | null, owned: readonly string[]): CatalogPrice {
  if (!id || owned.includes(id)) {
    return null;
  }

  return 100;
}
