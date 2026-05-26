import { SecureKeys, secureDelete, secureGet, secureSet } from "@/src/storage";

const COMPLETE_VALUE = "true";

export async function hasCompletedTutorial(): Promise<boolean> {
  return (await secureGet(SecureKeys.TUTORIAL_COMPLETED)) === COMPLETE_VALUE;
}

export async function markTutorialCompleted(): Promise<void> {
  await secureSet(SecureKeys.TUTORIAL_COMPLETED, COMPLETE_VALUE);
}

/**
 * Clears the tutorial-completed flag so the onboarding tutorial replays on the
 * next launch. Backs the dev menu's reset action — lets the first-run flow be
 * rehearsed repeatedly without reinstalling the app.
 */
export async function resetTutorial(): Promise<void> {
  await secureDelete(SecureKeys.TUTORIAL_COMPLETED);
}
