import * as THREE from "three";

export function updateHeadTracking(head: THREE.Object3D, target: THREE.Vector2, delta: number, enabled: boolean, busy: boolean) {
  if (busy) return;
  const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(
    enabled ? target.y * 0.28 : 0,
    enabled ? target.x * 0.55 : 0,
    0,
    "YXZ",
  ));
  head.quaternion.slerp(rotation, 1 - Math.exp(-delta * 12));
}
