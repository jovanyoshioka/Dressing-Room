import * as THREE from "three";

/** Measure the full clip on a clone so framing never changes the live pose. */
export function animationBounds(model: THREE.Object3D, clip: THREE.AnimationClip) {
  const copy = model.clone(true);
  const mixer = new THREE.AnimationMixer(copy);
  mixer.clipAction(clip).play();
  const bounds = new THREE.Box3();
  for (let step = 0; step <= 60; step++) {
    mixer.setTime((clip.duration * step) / 60);
    copy.updateMatrixWorld(true);
    bounds.union(new THREE.Box3().setFromObject(copy));
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(copy);
  // Allow the user to rotate the character while the clip plays.
  const radius = Math.hypot(
    Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x)),
    Math.max(Math.abs(bounds.min.z), Math.abs(bounds.max.z)),
  );
  bounds.min.x = bounds.min.z = -radius;
  bounds.max.x = bounds.max.z = radius;
  return bounds;
}

/** Preserve the original camera aim and find a distance with room above the head. */
export function animationCameraDistance(camera: THREE.PerspectiveCamera, bounds: THREE.Box3) {
  const probe = camera.clone();
  const point = new THREE.Vector3();
  for (let distance = 5.4; distance <= 24; distance += 0.1) {
    probe.position.set(0, 1.4, distance);
    probe.lookAt(0, 1, 0);
    probe.updateMatrixWorld(true);
    let fits = true;
    for (const x of [bounds.min.x, bounds.max.x])
      for (const y of [bounds.min.y, bounds.max.y])
        for (const z of [bounds.min.z, bounds.max.z]) {
          point.set(x, y, z).project(probe);
          if (Math.abs(point.x) > 0.88 || Math.abs(point.y) > 0.88) fits = false;
        }
    if (fits) return distance;
  }
  return 24;
}
