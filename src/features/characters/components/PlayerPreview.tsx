import { useRef, useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { animationBounds, animationCameraDistance } from "../animations/AnimationFraming";
import { updateHeadTracking } from "../previews/HeadTracking";
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
    framing = useRef<{ bounds: THREE.Box3 | null; aspect: number; distance: number }>({ bounds: null, aspect: 0, distance: 5.4 }),
    { camera, gl, scene } = useThree();

  const jumpBounds = useMemo(
    () => new Map(["animation.jump", "animation.spin-jump"].map((id) => {
      const animation = runtime.library.get(id);
      return [animation.name, animationBounds(view.character.model, animation.clip)];
    })),
    [runtime, view.character],
  );

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
    const activeBounds = jumpBounds.get(runtime.animations.status(view.character).name);
    const playingJump = !!activeBounds;
    if (camera instanceof THREE.PerspectiveCamera) {
      if (playingJump && (framing.current.bounds !== activeBounds || framing.current.aspect !== camera.aspect)) {
        framing.current = { bounds: activeBounds!, aspect: camera.aspect, distance: animationCameraDistance(camera, activeBounds!) };
      }
      const distance = playingJump ? framing.current.distance : 5.4;
      // The anticipation at the start of Jump gives the camera time to pull back.
      camera.position.z = THREE.MathUtils.damp(camera.position.z, distance, playingJump ? 16 : 8, delta);
      if (Math.abs(camera.position.z - distance) < 0.001) camera.position.z = distance;
      camera.lookAt(0, 1, 0);
    }
    runtime.animations.update(view.character, delta);
    updateHeadTracking(head, target.current, delta, tracking, runtime.animations.status(view.character).busy);
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
