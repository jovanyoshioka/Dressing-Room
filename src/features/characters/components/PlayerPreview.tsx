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
  const group = useRef<THREE.Group>(null);
  const target = useRef(new THREE.Vector2());
  const framing = useRef<{
    bounds: THREE.Box3 | null;
    aspect: number;
    distance: number;
  }>({ bounds: null, aspect: 0, distance: 5.4 });

  const { camera, gl, scene } = useThree();

  const jumpBounds = useMemo(
    () =>
      new Map(
        ["animation.jump", "animation.spin-jump"].map((id) => {
          const animation = runtime.library.get(id);
          return [
            animation.name,
            animationBounds(view.character.model, animation.clip),
          ];
        }),
      ),
    [runtime, view.character],
  );

  useEffect(() => {
    camera.lookAt(0, 1, 0);
    camera.updateProjectionMatrix();

    view.camera = camera;
    view.renderer = gl;
    view.scene = scene;

    const canvas = gl.domElement;
    let dragging = false;
    let lastX = 0;

    const rotationDegrees = () => {
      const degrees = THREE.MathUtils.radToDeg(view.angle);
      return degrees >= 0 && degrees <= 360
        ? degrees
        : ((degrees % 360) + 360) % 360;
    };

    const updateRotationValue = () => {
      const degrees = Math.round(rotationDegrees());
      canvas.setAttribute("aria-valuenow", String(degrees));
      canvas.setAttribute("aria-valuetext", `${degrees} degrees`);
    };

    canvas.tabIndex = 0;
    canvas.setAttribute("role", "slider");
    canvas.setAttribute("aria-label", "Character rotation");
    canvas.setAttribute("aria-orientation", "horizontal");
    canvas.setAttribute("aria-valuemin", "0");
    canvas.setAttribute("aria-valuemax", "360");
    canvas.setAttribute(
      "aria-description",
      "Use the arrow keys to rotate the character. Hold Shift for larger steps. Home and End face forward. You can also drag to rotate.",
    );
    canvas.title = "Drag or use arrow keys to rotate the character";
    updateRotationValue();

    const key = (e: KeyboardEvent) => {
      canvas.removeAttribute("data-pointer-focus");
      if (e.altKey || e.ctrlKey || e.metaKey) return;

      const degrees = rotationDegrees();
      const step = e.shiftKey ? 15 : 5;
      let next: number;

      switch (e.key) {
        case "ArrowLeft":
        case "ArrowDown":
          next = degrees - step;
          break;
        case "ArrowRight":
        case "ArrowUp":
          next = degrees + step;
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = 360;
          break;
        default:
          return;
      }

      e.preventDefault();
      view.angle = THREE.MathUtils.degToRad(next);
      updateRotationValue();
    };

    const moveHead = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      target.current.set(
        THREE.MathUtils.clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1),
        THREE.MathUtils.clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1),
      );
    };

    const down = (e: PointerEvent) => {
      canvas.setAttribute("data-pointer-focus", "");
      canvas.focus({ preventScroll: true });
      dragging = true;
      lastX = e.clientX;
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = "grabbing";
    };

    const move = (e: PointerEvent) => {
      if (dragging) {
        view.angle += (e.clientX - lastX) * 0.012;
        lastX = e.clientX;
        updateRotationValue();
      }
    };

    const up = () => {
      dragging = false;
      canvas.style.cursor = "grab";
    };

    const blur = () => canvas.removeAttribute("data-pointer-focus");

    window.addEventListener("pointermove", moveHead);
    canvas.addEventListener("keydown", key);
    canvas.addEventListener("blur", blur);
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);

    return () => {
      window.removeEventListener("pointermove", moveHead);
      canvas.removeEventListener("keydown", key);
      canvas.removeEventListener("blur", blur);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      view.character.model.getObjectByName("head")?.quaternion.identity();
    };
  }, [view, gl, camera, scene]);

  useFrame((_, delta) => {
    if (group.current) {
      group.current.rotation.y = view.angle;
    }

    const head = view.character.model.getObjectByName("head")!;
    const activeBounds = jumpBounds.get(
      runtime.animations.status(view.character).name,
    );
    const playingJump = !!activeBounds;

    if (camera instanceof THREE.PerspectiveCamera) {
      if (
        playingJump &&
        (framing.current.bounds !== activeBounds ||
          framing.current.aspect !== camera.aspect)
      ) {
        framing.current = {
          bounds: activeBounds!,
          aspect: camera.aspect,
          distance: animationCameraDistance(camera, activeBounds!),
        };
      }

      const distance = playingJump ? framing.current.distance : 5.4;

      // The anticipation at the start of Jump gives the camera time to pull back.
      camera.position.z = THREE.MathUtils.damp(
        camera.position.z,
        distance,
        playingJump ? 16 : 8,
        delta,
      );

      if (Math.abs(camera.position.z - distance) < 0.001) {
        camera.position.z = distance;
      }

      camera.lookAt(0, 1, 0);
    }

    runtime.animations.update(view.character, delta);

    updateHeadTracking(
      head,
      target.current,
      delta,
      tracking,
      runtime.animations.status(view.character).busy,
    );
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
