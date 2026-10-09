import type { AnimationDefinition } from "../types";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export class AnimationLibrary {
  loader: GLTFLoader;
  definitions: Map<string, AnimationDefinition>;

  constructor() {
    this.loader = new GLTFLoader();
    this.definitions = new Map();
  }

  async load() {
    await Promise.all(
      ["jump", "wave"].map(async (name) => {
        const response = await fetch(
          `${import.meta.env.BASE_URL}assets/animations/${name}.json`,
        );
        if (!response.ok) throw new Error("Animation metadata missing.");
        const metadata = readMetadata(await response.json()),
          gltf = await this.loader.loadAsync(
            import.meta.env.BASE_URL + metadata.asset,
          );
        const clip = gltf.animations.find((c) => c.name === metadata.name);
        if (!clip) throw new Error(`Missing ${metadata.name} clip.`);
        for (const track of clip.tracks) {
          if (
            !/^(root\.position|(head|body|rightArm|leftArm|rightLeg|leftLeg)\.quaternion)$/.test(
              track.name,
            )
          )
            throw new Error(`Invalid animation target: ${track.name}`);
        }

        this.definitions.set(metadata.id, { ...metadata, clip });
      }),
    );
    return this;
  }

  get(id: string) {
    const a = this.definitions.get(id);
    if (!a) throw new Error("Unknown animation.");
    return a;
  }
}

function readMetadata(
  value: unknown,
): Pick<AnimationDefinition, "id" | "name" | "asset"> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Invalid animation metadata.");
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    !record.id ||
    typeof record.name !== "string" ||
    !record.name ||
    typeof record.asset !== "string" ||
    !record.asset
  )
    throw Error(
      "Animation metadata requires an ID, name, and asset reference.",
    );
  return { id: record.id, name: record.name, asset: record.asset };
}
