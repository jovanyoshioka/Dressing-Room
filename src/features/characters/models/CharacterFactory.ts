import type {
  BodyType,
  CharacterDefinition,
  CharacterInstance,
  SkinDefinition,
} from "../types";
import type { ModelLibrary } from "./ModelLibrary";
import type { SkinNormalizer } from "../skins/SkinNormalizer";
import type { AnimationManager } from "../animations/AnimationManager";
import * as THREE from "three";

export class CharacterFactory {
  models: ModelLibrary;
  normalizer: SkinNormalizer;
  animations: AnimationManager;
  constructor(
    models: ModelLibrary,
    normalizer: SkinNormalizer,
    animations: AnimationManager,
  ) {
    this.models = models;
    this.normalizer = normalizer;
    this.animations = animations;
  }

  async create(
    definition: CharacterDefinition,
    skin: SkinDefinition,
  ): Promise<CharacterInstance> {
    const bodyType = definition.bodyOverride || skin.bodyType;
    const model = (await this.models.load(bodyType)).clone(true),
      materials: THREE.MeshStandardMaterial[] = [];
    model.traverse((n) => {
      if (n instanceof THREE.Mesh) {
        if (!(n.material instanceof THREE.MeshStandardMaterial))
          throw new Error("Expected a skin material.");
        n.material = n.material.clone();
        materials.push(n.material);
      }
    });

    const c: CharacterInstance = {
      id: definition.id,
      definition: { ...definition },
      model,
      bodyType,
      materials,
      skin,
      skinFormat: "",
      texture: null,
    };

    try {
      this.applySkin(c, skin);
      return c;
    } catch (e) {
      materials.forEach((m) => m.dispose());
      throw e;
    }
  }

  applySkin(character: CharacterInstance, skin: SkinDefinition) {
    const result = this.normalizer.normalize(skin, character.bodyType),
      texture = new THREE.CanvasTexture(result.canvas);
    texture.flipY = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = texture.magFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    for (const material of character.materials) {
      material.map = texture;
      material.needsUpdate = true;
    }

    character.texture?.dispose();
    character.texture = texture;
    character.skin = skin;
    character.skinFormat = result.legacy
      ? "64 × 32 legacy"
      : `${result.canvas.width} × ${result.canvas.height} modern`;
  }

  async change(
    character: CharacterInstance,
    skin: SkinDefinition,
    bodyOverride: BodyType | null | undefined = character.definition
      .bodyOverride,
  ) {
    const bodyType = bodyOverride || skin.bodyType;
    if (bodyType === character.bodyType) {
      this.applySkin(character, skin);
      character.definition.bodyOverride = bodyOverride;
      return character;
    }

    const replacement = await this.create(
      { ...character.definition, bodyOverride },
      skin,
    );
    replacement.model.position.copy(character.model.position);
    replacement.model.quaternion.copy(character.model.quaternion);
    replacement.model.scale.copy(character.model.scale);
    this.dispose(character);
    return replacement;
  }

  dispose(character: CharacterInstance) {
    this.animations.dispose(character);
    character.texture?.dispose();
    character.materials.forEach((m) => m.dispose());
  }
}
