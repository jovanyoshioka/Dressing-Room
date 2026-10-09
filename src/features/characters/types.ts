import type * as THREE from "three";
import type { SkinPackImporter } from "./skins/SkinPackImporter";
import type { SkinCatalog } from "./skins/SkinCatalog";
import type { SkinNormalizer } from "./skins/SkinNormalizer";
import type { ModelLibrary } from "./models/ModelLibrary";
import type { CharacterFactory } from "./models/CharacterFactory";
import type { AnimationLibrary } from "./animations/AnimationLibrary";
import type { AnimationManager } from "./animations/AnimationManager";

export type BodyType = "classic" | "slim";

export type GeometryId =
  "geometry.humanoid.custom" | "geometry.humanoid.customSlim";

export type Version = [number, number, number];

export type JsonObject = Record<string, unknown>;

export interface Manifest extends JsonObject {
  format_version: 1 | 2;
  header: JsonObject & { name: string; uuid: string; version: Version };
  modules: Array<
    JsonObject & { type: "skin_pack"; uuid: string; version: Version }
  >;
}

export interface SkinRecord extends JsonObject {
  localization_name: string;
  geometry: string;
  texture: string;
  type: "free" | "paid";
}

export interface SkinMetadata extends JsonObject {
  serialize_name: string;
  localization_name: string;
  skins: unknown[];
}

export interface PackDefinition {
  id: string;
  version: Version;
  name: string;
  manifest: Manifest;
  sourceMetadata: SkinMetadata;
  localization: Record<string, Record<string, string>>;
  files: Map<string, Blob>;
  fingerprint: string;
  languages: unknown;
}

export interface SkinDefinition {
  id: string;
  name: string;
  packId: string | null;
  index?: number;
  sourceRecord: SkinRecord | null;
  blob: Blob;
  image: ImageBitmap;
  geometry: string;
  bodyType: BodyType;
  sourceArmLayout: BodyType;
}

export interface Diagnostic {
  scope: "pack" | "skin";
  index?: number;
  code: string;
  message: string;
}

export interface PackImportResult {
  pack: PackDefinition;
  skins: SkinDefinition[];
  diagnostics: Diagnostic[];
}

export interface PackRootsResult {
  roots: string[];
}

export type ImportResult = PackImportResult | PackRootsResult;

export interface ImportOptions {
  root?: string;
  locale?: string;
}

export interface CharacterDefinition {
  id: string;
  role?: string;
  bodyOverride?: BodyType | null;
}

export interface CharacterInstance {
  id: string;
  definition: CharacterDefinition;
  model: THREE.Group;
  bodyType: BodyType;
  materials: THREE.MeshStandardMaterial[];
  skin: SkinDefinition;
  texture: THREE.CanvasTexture | null;
  skinFormat: string;
}

export interface AnimationDefinition {
  id: string;
  name: string;
  asset: string;
  clip: THREE.AnimationClip;
}

export interface AnimationStatus {
  name: string;
  busy: boolean;
  paused: boolean;
}

export interface CharacterView {
  character: CharacterInstance;
  autoRotate: boolean;
  angle: number;
  changing: boolean;
  change: (skin: SkinDefinition, override?: BodyType | null) => Promise<void>;
  card?: HTMLElement | null;
  camera?: THREE.Camera;
  renderer?: THREE.WebGLRenderer;
  scene?: THREE.Scene;
}

export interface StudioRuntime {
  THREE: typeof THREE;
  importer: SkinPackImporter;
  catalog: SkinCatalog;
  normalizer: SkinNormalizer;
  models: ModelLibrary;
  library: AnimationLibrary;
  animations: AnimationManager;
  factory: CharacterFactory;
  views: CharacterView[];
  onChange: () => void;
  disposed: boolean;
  dispose: () => void;
}

export type ReviewRequest =
  | { roots: string[]; result?: never; conflict?: never }
  | { roots?: never; result: PackImportResult; conflict: boolean };

export type ReviewResponse = string | true | null;

export type ErrorHandler = (error: unknown) => void;
