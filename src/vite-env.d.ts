/// <reference types="vite/client" />
import type { StudioRuntime } from "./features/characters/types";
import "react";
declare global {
  interface Window {
    studio?: StudioRuntime & { ready: boolean };
    unmountStudio?: () => void;
  }
}
declare module "react" {
  interface InputHTMLAttributes<T> {
    webkitdirectory?: string;
  }
}
