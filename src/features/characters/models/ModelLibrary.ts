import { Mesh, type Group } from "three";
import type { BodyType } from "../types";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export const GEOMETRY_TYPES = Object.freeze({
  "geometry.humanoid.custom": "classic",
  "geometry.humanoid.customSlim": "slim",
} as const);

export const PARTS = Object.freeze([
  "body",
  "head",
  "rightArm",
  "leftArm",
  "rightLeg",
  "leftLeg",
]);

export class ModelLibrary {
  loader: GLTFLoader;
  cache: Map<BodyType, Promise<Group>>;

  constructor() {
    this.loader = new GLTFLoader();
    this.cache = new Map();
  }

  async load(bodyType: BodyType): Promise<Group> {
    if (!["classic", "slim"].includes(bodyType))
      throw new Error("Unsupported body type.");
    if (!this.cache.has(bodyType))
      this.cache.set(
        bodyType,
        this.loader
          .loadAsync(`${import.meta.env.BASE_URL}assets/models/${bodyType}.glb`)
          .then((g) => {
            this.validate(g.scene);
            return g.scene;
          })
          .catch((e) => {
            this.cache.delete(bodyType);
            throw e;
          }),
      );
    return this.cache.get(bodyType)!;
  }

  validate(model: Group) {
    const root = model.getObjectByName("root");
    if (!root) throw new Error("Model missing root.");
    for (const name of ["root", ...PARTS]) {
      let count = 0;
      model.traverse((n) => {
        if (n.name === name) count++;
      });

      if (count !== 1) throw new Error(`Model must have exactly one ${name}.`);
    }

    for (const name of PARTS) {
      const pivot = model.getObjectByName(name)!;
      if (
        pivot.parent !== root ||
        !pivot.children.some(
          (n) => n.name === name + "_base" && n instanceof Mesh,
        ) ||
        !pivot.children.some(
          (n) => n.name === name + "_overlay" && n instanceof Mesh,
        )
      )
        throw new Error(`Invalid model hierarchy: ${name}.`);
      if (
        pivot.quaternion.x ** 2 +
          pivot.quaternion.y ** 2 +
          pivot.quaternion.z ** 2 >
          1e-12 ||
        root.quaternion.x ** 2 +
          root.quaternion.y ** 2 +
          root.quaternion.z ** 2 >
          1e-12
      )
        throw new Error("Model resting rotations must match.");
    }
  }
}
