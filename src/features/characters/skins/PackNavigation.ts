import type { PackDefinition } from "../types";

export const DUNGEONS_PACK = "dungeons_ii_hero";

/** Locked packs remain previewable without changing ownership. */
export function isSkinPackLocked(pack: PackDefinition | undefined) {
  return !!pack && ["elemental_knights", DUNGEONS_PACK].includes(pack.sourceMetadata.serialize_name);
}

export function dressingRoomPackUrl(base: string) {
  return `${base}index.html?pack=${DUNGEONS_PACK}&from=marketplace`;
}

export const marketplaceUrl = (base: string) => `${base}marketplace.html`;
export const packEntryOrigin = (search: string) => new URLSearchParams(search).get("from") === "marketplace" ? "marketplace" as const : "catalog" as const;

export interface PackNavigationState { tab: number; packId: string | null; origin: "marketplace" | "catalog"; }
export const initialPackNavigation: PackNavigationState = { tab: 2, packId: null, origin: "catalog" };
export type PackNavigationAction =
  | { type: "tab"; tab: number }
  | { type: "open"; packId: string; origin: PackNavigationState["origin"] }
  | { type: "catalog" };

export function packNavigationReducer(state: PackNavigationState, action: PackNavigationAction): PackNavigationState {
  switch (action.type) {
    case "tab": return { ...state, tab: action.tab };
    case "open": return { tab: 2, packId: action.packId, origin: action.origin };
    case "catalog": return { ...initialPackNavigation };
  }
}

export function catalogLocation(href: string) {
  const url = new URL(href);
  url.searchParams.delete("pack");
  url.searchParams.delete("from");
  return url.pathname + url.search + url.hash;
}

/** Resolve a catalog key after loading, rather than exposing internal pack UUIDs. */
export function requestedSkinPack(packs: Iterable<PackDefinition>, search: string) {
  const requested = new URLSearchParams(search).get("pack");
  if (!requested) return undefined;
  return [...packs].find((pack) => pack.sourceMetadata.serialize_name === requested);
}
