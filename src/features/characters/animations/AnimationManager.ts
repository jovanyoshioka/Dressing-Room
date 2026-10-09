import type { CharacterInstance, AnimationStatus } from "../types";
import type { AnimationLibrary } from "./AnimationLibrary";
import * as THREE from "three";
import { PARTS } from "../models/ModelLibrary";

interface PlaybackState {
  mixer: THREE.AnimationMixer;
  active: {
    action: THREE.AnimationAction;
    finish: (event: THREE.AnimationMixerEventMap["finished"]) => void;
    resolve: (value: boolean) => void;
  } | null;
  token: number;
  paused: boolean;
  status: string;
  transition: {
    clip: THREE.AnimationClip;
    action: THREE.AnimationAction;
    remaining: number;
  } | null;
}

export class AnimationManager {
  library: AnimationLibrary;
  states: Map<CharacterInstance, PlaybackState>;

  constructor(library: AnimationLibrary) {
    this.library = library;
    this.states = new Map();
  }

  state(character: CharacterInstance): PlaybackState {
    if (!this.states.has(character))
      this.states.set(character, {
        mixer: new THREE.AnimationMixer(character.model),
        active: null,
        token: 0,
        paused: false,
        status: "Idle",
        transition: null,
      });

    return this.states.get(character)!;
  }

  play(character: CharacterInstance, id: string) {
    this.library.get(id);
    const state = this.state(character),
      snapshot = state.active ? this.snapshot(character) : null;
    this.stop(character);
    const completion = this.start(character, id);
    if (snapshot) {
      const action = state.mixer.clipAction(snapshot);
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play().fadeOut(0.12);
      state.active!.action.fadeIn(0.12);
      state.transition = { clip: snapshot, action, remaining: 0.12 };
    }

    return completion;
  }

  snapshot(character: CharacterInstance) {
    const tracks: THREE.KeyframeTrack[] = PARTS.map((name) => {
      const q = character.model.getObjectByName(name)!.quaternion.toArray();
      return new THREE.QuaternionKeyframeTrack(
        name + ".quaternion",
        [0, 0.12],
        [...q, ...q],
      );
    });

    const p = character.model.getObjectByName("root")!.position.toArray();
    tracks.push(
      new THREE.VectorKeyframeTrack("root.position", [0, 0.12], [...p, ...p]),
    );
    return new THREE.AnimationClip("transition", 0.12, tracks);
  }

  start(character: CharacterInstance, id: string) {
    const animation = this.library.get(id),
      s = this.state(character),
      action = s.mixer.clipAction(animation.clip);
    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = false;
    action.paused = false;
    s.paused = false;
    s.mixer.timeScale = 1;
    s.status = animation.name;
    return new Promise<boolean>((resolve) => {
      const finish = (event: THREE.AnimationMixerEventMap["finished"]) => {
        if (event.action !== action) return;
        s.mixer.removeEventListener("finished", finish);
        queueMicrotask(() => {
          if (s.active?.action !== action) return;
          action.stop();
          s.active = null;
          s.status = "Idle";
          resolve(true);
        });
      };

      s.active = { action, finish, resolve };
      s.mixer.addEventListener("finished", finish);
      action.play();
    });
  }

  async playSequence(character: CharacterInstance, ids: string[]) {
    ids.forEach((id) => this.library.get(id));
    this.stop(character);
    const s = this.state(character),
      token = s.token;
    for (const id of ids) {
      if (s.token !== token) return false;
      if (!(await this.start(character, id))) return false;
    }

    return true;
  }

  pause(character: CharacterInstance) {
    const s = this.state(character);
    if (s.active) {
      s.paused = true;
      s.mixer.timeScale = 0;
      s.active.action.paused = true;
    }
  }

  resume(character: CharacterInstance) {
    const s = this.state(character);
    if (s.active) {
      s.paused = false;
      s.mixer.timeScale = 1;
      s.active.action.paused = false;
    }
  }

  stop(character: CharacterInstance) {
    const s = this.state(character);
    s.token++;
    if (s.active) {
      const a = s.active;
      s.mixer.removeEventListener("finished", a.finish);
      s.active = null;
      a.resolve(false);
    }

    if (s.transition) {
      s.transition.action.stop();
      s.mixer.uncacheClip(s.transition.clip);
      s.transition = null;
    }

    s.mixer.stopAllAction();
    s.mixer.timeScale = 1;
    s.paused = false;
    s.status = "Idle";
  }

  update(character: CharacterInstance, delta: number) {
    const s = this.state(character);
    s.mixer.update(delta);
    if (s.transition && !s.paused) {
      s.transition.remaining -= delta;
      if (s.transition.remaining <= 0) {
        s.transition.action.stop();
        s.mixer.uncacheClip(s.transition.clip);
        s.transition = null;
      }
    }
  }

  status(character: CharacterInstance): AnimationStatus {
    const s = this.state(character);
    return { name: s.status, busy: !!s.active, paused: s.paused };
  }

  dispose(character: CharacterInstance) {
    this.stop(character);
    this.states.get(character)!.mixer.uncacheRoot(character.model);
    this.states.delete(character);
  }
}
