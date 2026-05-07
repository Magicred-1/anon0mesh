import { SecureKeys, secureGet, secureSet } from "@/src/storage";

const COMPLETE_VALUE = "true";

export async function hasCompletedTutorial(): Promise<boolean> {
  return (await secureGet(SecureKeys.TUTORIAL_COMPLETED)) === COMPLETE_VALUE;
}

export async function markTutorialCompleted(): Promise<void> {
  await secureSet(SecureKeys.TUTORIAL_COMPLETED, COMPLETE_VALUE);
}
