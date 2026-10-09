import { useRef, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import type { StudioRuntime, CharacterView } from "../types";

function Player({
  runtime,
  view,
  tracking,
}: {
  runtime: StudioRuntime;
  view: CharacterView;
  tracking: boolean;
}) {
  const group = useRef<THREE.Group>(null),
    target = useRef(new THREE.Vector2()),
    { camera, gl, scene } = useThree();

  useEffect(() => {
    camera.lookAt(0, 1, 0);
    camera.updateProjectionMatrix();
    view.camera = camera;
    view.renderer = gl;
    view.scene = scene;
    const canvas = gl.domElement;
    let dragging = false,
      lastX = 0;

    const moveHead = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      target.current.set(
        THREE.MathUtils.clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1),
        THREE.MathUtils.clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1),
      );
    };

    const down = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = "grabbing";
    };

    const move = (e: PointerEvent) => {
      if (dragging) {
        view.angle += (e.clientX - lastX) * 0.012;
        lastX = e.clientX;
      }
    };

    const up = () => {
      dragging = false;
      canvas.style.cursor = "grab";
    };

    window.addEventListener("pointermove", moveHead);
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", moveHead);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      view.character.model.getObjectByName("head")?.quaternion.identity();
    };
  }, [view, gl, camera, scene]);
  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y = view.angle;
    const head = view.character.model.getObjectByName("head")!;
    const q = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        tracking ? target.current.y * 0.28 : 0,
        tracking ? target.current.x * 0.55 : 0,
        0,
        "YXZ",
      ),
    );
    head.quaternion.slerp(q, 1 - Math.exp(-delta * 12));
    // Keep animations idle in this dressing-room view.
    runtime.animations.status(view.character);
  });

  return (
    <>
      <PerspectiveCamera makeDefault fov={30} position={[0, 1.4, 5.4]} />
      <hemisphereLight args={[0xffffff, 0x777777, 2]} />
      <directionalLight position={[-3, 5, 5]} intensity={2} />
      <group ref={group}>
        <primitive object={view.character.model} dispose={null} />
      </group>
    </>
  );
}

export function PlayerPreview(props: {
  runtime: StudioRuntime;
  view: CharacterView;
  tracking: boolean;
}) {
  return (
    <Canvas
      className="player-canvas"
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.toneMapping = THREE.NoToneMapping;
        gl.setClearColor(0, 0);
      }}
    >
      <Player {...props} />
    </Canvas>
  );
}
