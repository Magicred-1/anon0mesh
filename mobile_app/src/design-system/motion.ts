import { motionTokens } from "@/src/design-system/tokens";

let _motionScale = 1;

export function getMotionScale(): number {
  return _motionScale;
}

export function setMotionScale(scale: number) {
  _motionScale = scale;
}

export function scaled(ms: number): number {
  return ms * _motionScale;
}

export const appMotion = motionTokens;
