import * as Haptics from "expo-haptics";

let muted = false;

export function setHapticsMuted(value: boolean) {
  muted = value;
}

export function isHapticsMuted() {
  return muted;
}

function fire(fn: () => Promise<void>) {
  if (muted) return;
  void fn().catch(() => undefined);
}

export function tap() {
  fire(() => Haptics.selectionAsync());
}

export function select() {
  fire(() => Haptics.selectionAsync());
}

export function lightPress() {
  fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

export function mediumPress() {
  fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

export function confirm() {
  fire(() =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  );
}

export function warning() {
  fire(() =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  );
}

export function error() {
  fire(() =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  );
}

export function dragStart() {
  fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

export function dragCross() {
  fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

export function releaseHeavy() {
  fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
}
