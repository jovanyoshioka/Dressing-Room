import type { PackDefinition } from "../types";

export const DUNGEONS_PACK = "dungeons_ii_hero";

/** Locked packs remain previewable without changing ownership. */
export function isSkinPackLocked(pack: PackDefinition | undefined): boolean {
  if (!pack) {
    return false;
  }

  return ["elemental_knights", DUNGEONS_PACK].includes(
    pack.sourceMetadata.serialize_name,
  );
}

export function dressingRoomPackUrl(base: string): string {
  return `${base}index.html?pack=${DUNGEONS_PACK}&from=marketplace`;
}

export function marketplaceUrl(base: string): string {
  return `${base}marketplace.html`;
}

export function packEntryOrigin(search: string): "marketplace" | "catalog" {
  const params = new URLSearchParams(search);
  return params.get("from") === "marketplace" ? "marketplace" : "catalog";
}

export interface PackNavigationState {
  tab: number;
  packId: string | null;
  origin: "marketplace" | "catalog";
}

export const initialPackNavigation: PackNavigationState = {
  tab: 2,
  packId: null,
  origin: "catalog",
};

export type PackNavigationAction =
  | { type: "tab"; tab: number }
  | { type: "open"; packId: string; origin: PackNavigationState["origin"] }
  | { type: "catalog" };

export function packNavigationReducer(
  state: PackNavigationState,
  action: PackNavigationAction,
): PackNavigationState {
  switch (action.type) {
    case "tab":
      return {
        ...state,
        tab: action.tab,
      };

    case "open":
      return {
        tab: 2,
        packId: action.packId,
        origin: action.origin,
      };

    case "catalog":
      return {
        ...initialPackNavigation,
      };
  }
}

export function catalogLocation(href: string): string {
  const url = new URL(href);
  url.searchParams.delete("pack");
  url.searchParams.delete("from");
  return url.pathname + url.search + url.hash;
}

/** Resolve a catalog key after loading, rather than exposing internal pack UUIDs. */
export function requestedSkinPack(
  packs: Iterable<PackDefinition>,
  search: string,
): PackDefinition | undefined {
  const requested = new URLSearchParams(search).get("pack");
  if (!requested) {
    return undefined;
  }

  return [...packs].find(
    (pack) => pack.sourceMetadata.serialize_name === requested,
  );
}
