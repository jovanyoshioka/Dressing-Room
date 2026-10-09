import type {
  StudioRuntime,
  CharacterView,
  SkinDefinition,
  BodyType,
} from "./types";
import * as THREE from "three";
import { SkinPackImporter } from "./skins/SkinPackImporter";
import { SkinCatalog } from "./skins/SkinCatalog";
import { SkinNormalizer } from "./skins/SkinNormalizer";
import { ModelLibrary } from "./models/ModelLibrary";
import { CharacterFactory } from "./models/CharacterFactory";
import { AnimationLibrary } from "./animations/AnimationLibrary";
import { AnimationManager } from "./animations/AnimationManager";

export async function createRuntime(): Promise<StudioRuntime> {
  const importer = new SkinPackImporter();
  const catalog = new SkinCatalog();
  const normalizer = new SkinNormalizer();
  const models = new ModelLibrary();
  const library = new AnimationLibrary();
  const animations = new AnimationManager(library);
  const factory = new CharacterFactory(models, normalizer, animations);
  const runtime: StudioRuntime = {
    THREE,
    importer,
    catalog,
    normalizer,
    models,
    library,
    animations,
    factory,
    views: [],
    onChange: () => {},
    disposed: false,
    dispose: () => {},
  };

  runtime.dispose = () => {
    if (runtime.disposed) return;
    runtime.disposed = true;
    runtime.onChange = () => {};
    runtime.views.forEach((v) => factory.dispose(v.character));
    catalog.skins.forEach((s) => s.image.close());
    normalizer.cache.clear();
    for (const template of models.cache.values())
      template
        .then((model) =>
          model.traverse((n) => {
            if (n instanceof THREE.Mesh) {
              n.geometry.dispose();
              if (Array.isArray(n.material))
                n.material.forEach((m) => m.dispose());
              else n.material.dispose();
            }
          }),
        )
        .catch(() => {});
    models.cache.clear();
  };

  try {
    const [, builtins] = await Promise.all([
      library.load(),
      Promise.all(
        ["my_skin_pack", "elemental_knights"].map(async (name) => {
          const r = await fetch(
            `${import.meta.env.BASE_URL}assets/skin-packs/${name}.mcpack`,
          );
          if (!r.ok) throw Error("Built-in pack missing.");
          const result = await importer.archive(await r.blob());
          if ("roots" in result)
            throw Error("Built-in pack must contain exactly one root.");
          if (result.diagnostics.length || !result.skins.length)
            throw Error("Built-in pack validation failed.");
          return result;
        }),
      ),
    ]);
    builtins.forEach((result) => catalog.add(result));
    const gray = catalog.addPNG(
      await importer.png(
        await (
          await fetch(`${import.meta.env.BASE_URL}assets/custom.png`)
        ).blob(),
        "classic",
      ),
    );
    gray.name = "Import Skin";
    gray.isImportPlaceholder = true;
    for (const [name, id] of [["Steve", "player"]]) {
      const skin = [...catalog.skins.values()].find((s) => s.name === name)!,
        character = await factory.create({ id }, skin);
      const view: CharacterView = {
        character,
        autoRotate: false,
        angle: 0,
        changing: false,
        change: async () => {},
      };

      let changes: Promise<void> = Promise.resolve();
      view.change = (skin: SkinDefinition, override?: BodyType | null) => {
        changes = changes
          .catch(() => {})
          .then(async () => {
            if (runtime.disposed) return;
            view.changing = true;
            runtime.onChange();
            try {
              const next = await factory.change(view.character, skin, override);
              view.character = next;
              if (runtime.disposed) factory.dispose(next);
              else runtime.onChange();
            } finally {
              view.changing = false;
              runtime.onChange();
            }
          });

        return changes;
      };

      runtime.views.push(view);
    }

    return runtime;
  } catch (e) {
    runtime.dispose();
    throw e;
  }
}
