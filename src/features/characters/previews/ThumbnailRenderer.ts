import * as THREE from "three";
import type { StudioRuntime, SkinDefinition } from "../types";

/** One shared renderer keeps large catalogs below browser WebGL context limits. */

export class ThumbnailRenderer {
  private renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(
    -0.57,
    0.57,
    2.13,
    -0.08,
    0.1,
    30,
  );
  private cache = new Map<string, string[]>();
  private pending = Promise.resolve();
  private disposed = false;
  private rotations = new Set<() => void>();
  private runtime: StudioRuntime;

  constructor(runtime: StudioRuntime) {
    this.runtime = runtime;
    this.renderer.setSize(180, 350);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.setClearColor(0, 0);
    this.camera.position.set(0, 0, 6);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x777777, 2));
    const light = new THREE.DirectionalLight(0xffffff, 2);
    light.position.set(-3, 5, 6);
    this.scene.add(light);
  }

  frames(skin: SkinDefinition): Promise<string[]> {
    const key = `${skin.id}:front`;
    const known = this.cache.get(key);
    if (known) return Promise.resolve(known);
    const task = this.pending.then(async () => {
      if (this.disposed) return [];
      const cached = this.cache.get(key);
      if (cached) return cached;
      const character = await this.runtime.factory.create(
        { id: "thumbnail" },
        skin,
      );
      if (this.disposed) {
        this.runtime.factory.dispose(character);
        return [];
      }

      const result: string[] = [];
      this.scene.add(character.model);
      try {
        this.renderer.render(this.scene, this.camera);
        result.push(this.renderer.domElement.toDataURL("image/png"));
        this.cache.set(key, result);
        return result;
      } finally {
        this.scene.remove(character.model);
        this.runtime.factory.dispose(character);
      }
    });

    this.pending = task.then(
      () => {},
      () => {},
    );

    return task;
  }

  emote(id: string): Promise<string> {
    const key = `emote:${id}`;
    const known = this.cache.get(key);
    if (known) return Promise.resolve(known[0]);

    const task = this.pending.then(async () => {
      if (this.disposed) return "";

      const skin = [...this.runtime.catalog.skins.values()].find(
        (skin) => skin.isImportPlaceholder,
      )!;
      const character = await this.runtime.factory.create(
        { id: "emote-thumbnail" },
        skin,
      );

      if (this.disposed) {
        this.runtime.factory.dispose(character);
        return "";
      }

      character.model.rotation.y =
        id === "animation.spin-jump" ? THREE.MathUtils.degToRad(15) : -0.45;

      const mixer = new THREE.AnimationMixer(character.model);
      const clip = this.runtime.library.get(id).clip;
      mixer.clipAction(clip).play();

      const previewTimes: Record<string, number> = {
        "animation.jump": clip.duration * 0.4,
        "animation.wave": clip.duration * 0.3,
        "animation.clap": 0.8,
        "animation.spin-jump": 1.25,
        "animation.head-spin": 1.7,
      };

      mixer.update(previewTimes[id] ?? clip.duration * 0.3);

      // Keep Helicopter's extended-arm pose while fixing its icon to a clear 15-degree view.
      if (id === "animation.spin-jump") {
        character.model.getObjectByName("root")!.quaternion.identity();
      }

      // Square camera bounds preserve the model proportions in a square tile.
      // Fit the posed Import Skin model, including its head and extended limbs.
      character.model.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(character.model);
      const center = bounds.getCenter(new THREE.Vector3());
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 30);

      camera.position.copy(center).add(new THREE.Vector3(0, 1.7, 6));
      camera.lookAt(center);
      camera.updateMatrixWorld(true);

      const projected = new THREE.Box3();
      for (const x of [bounds.min.x, bounds.max.x]) {
        for (const y of [bounds.min.y, bounds.max.y]) {
          for (const z of [bounds.min.z, bounds.max.z]) {
            projected.expandByPoint(
              new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse),
            );
          }
        }
      }

      const halfSize =
        Math.max(
          projected.max.x,
          -projected.min.x,
          projected.max.y,
          -projected.min.y,
        ) * 1.12;

      camera.left = camera.bottom = -halfSize;
      camera.right = camera.top = halfSize;
      camera.updateProjectionMatrix();

      this.scene.add(character.model);

      try {
        this.renderer.setSize(240, 240);
        this.renderer.render(this.scene, camera);
        const image = this.renderer.domElement.toDataURL("image/png");
        this.cache.set(key, [image]);
        return image;
      } finally {
        this.scene.remove(character.model);
        mixer.stopAllAction();
        mixer.uncacheRoot(character.model);
        this.runtime.factory.dispose(character);
        this.renderer.setSize(180, 350);
      }
    });

    this.pending = task.then(
      () => {},
      () => {},
    );

    return task;
  }

  /** Draw continuously into the hovered tile; no encoded frame sequence or React updates. */
  animate(
    skin: SkinDefinition,
    canvas: HTMLCanvasElement,
    onError: (error: unknown) => void,
  ) {
    let stopped = false;
    let frame = 0;
    let character:
      Awaited<ReturnType<StudioRuntime["factory"]["create"]>> | undefined;

    const stop = () => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(frame);
      if (character) this.runtime.factory.dispose(character);
      this.rotations.delete(stop);
    };

    this.rotations.add(stop);
    canvas.width = 180;
    canvas.height = 350;
    const ctx = canvas.getContext("2d")!;
    this.runtime.factory
      .create({ id: "hover-preview" }, skin)
      .then((created) => {
        if (stopped || this.disposed) {
          this.runtime.factory.dispose(created);
          return;
        }

        character = created;
        let start: number | undefined;

        const draw = (time: number) => {
          if (stopped || this.disposed) return;
          start ??= time;
          // A full turn was 24 × 130ms; now take twice as long, at any frame rate.
          created.model.rotation.y =
            (((time - start) / 6240) % 1) * Math.PI * 2;
          try {
            this.scene.add(created.model);
            this.renderer.render(this.scene, this.camera);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(this.renderer.domElement, 0, 0);
          } catch (error) {
            stop();
            onError(error);
            return;
          } finally {
            this.scene.remove(created.model);
          }

          frame = requestAnimationFrame(draw);
        };

        frame = requestAnimationFrame(draw);
      })
      .catch((error) => {
        if (!stopped && !this.disposed) onError(error);
        stop();
      });

    return stop;
  }

  invalidate(ids: string[]) {
    for (const key of this.cache.keys())
      if (ids.some((id) => key.startsWith(id + ":"))) this.cache.delete(key);
  }

  dispose() {
    this.disposed = true;
    [...this.rotations].forEach((stop) => stop());
    this.cache.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
