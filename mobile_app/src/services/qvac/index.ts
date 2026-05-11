import type { CompletionRun, ModelProgressUpdate } from '@qvac/sdk';

export type QvacProgressPhase = 'download' | 'load';

export type QvacProgress = {
  readonly phase: QvacProgressPhase;
  readonly percentage: number | null;
  readonly message: string;
};

export type QvacSession = {
  readonly modelId: string;
  runCompletion(prompt: string): CompletionRun;
};

const QVAC_ENABLED = process.env.EXPO_PUBLIC_QVAC_ENABLED === 'true';

let activeModelId: string | null = null;
let initPromise: Promise<QvacSession> | null = null;
let qvacSdkPromise: Promise<typeof import('@qvac/sdk')> | null = null;

function loadSdk(): Promise<typeof import('@qvac/sdk')> {
  qvacSdkPromise ??= import('@qvac/sdk');
  return qvacSdkPromise;
}

function percent(progress: ModelProgressUpdate): number | null {
  const raw = Number(progress.percentage);
  if (!Number.isFinite(raw)) return null;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export function isQvacEnabled(): boolean {
  return QVAC_ENABLED;
}

export function isQvacReady(): boolean {
  return QVAC_ENABLED && activeModelId !== null;
}

export async function initQvac(
  onProgress?: (progress: QvacProgress) => void,
): Promise<QvacSession> {
  if (!QVAC_ENABLED) {
    throw new Error('QVAC is disabled. Set EXPO_PUBLIC_QVAC_ENABLED=true for the bounty build.');
  }

  if (activeModelId) {
    return createSession(activeModelId);
  }

  if (!initPromise) {
    initPromise = (async () => {
      const sdk = await loadSdk();
      const modelSrc = sdk.LLAMA_TOOL_CALLING_1B_INST_Q4_K;

      onProgress?.({
        phase: 'download',
        percentage: null,
        message: `Preparing ${modelSrc.name}`,
      });

      await sdk.downloadAsset({
        assetSrc: modelSrc,
        onProgress: (progress) => {
          onProgress?.({
            phase: 'download',
            percentage: percent(progress),
            message: 'Downloading local model',
          });
        },
      });

      onProgress?.({
        phase: 'load',
        percentage: null,
        message: 'Loading model into QVAC worker',
      });

      const modelId = await sdk.loadModel({
        modelSrc,
        modelConfig: {
          ctx_size: 2048,
          tools: true,
          toolsMode: sdk.TOOLS_MODE.dynamic,
          temp: 0.2,
          predict: 192,
          verbosity: sdk.VERBOSITY.ERROR,
        },
      });

      activeModelId = modelId;
      await sdk.getLoadedModelInfo({ modelId }).catch(() => undefined);

      onProgress?.({
        phase: 'load',
        percentage: 100,
        message: 'QVAC model ready',
      });

      return createSession(modelId);
    })().catch((error) => {
      initPromise = null;
      throw error;
    });
  }

  return initPromise;
}

export async function getQvac(): Promise<QvacSession> {
  if (!activeModelId) {
    return initQvac();
  }
  return createSession(activeModelId);
}

export async function unloadQvac(): Promise<void> {
  if (!activeModelId) return;
  const sdk = await loadSdk();
  const modelId = activeModelId;
  activeModelId = null;
  initPromise = null;
  await sdk.unloadModel({ modelId });
}

function createSession(modelId: string): QvacSession {
  return {
    modelId,
    runCompletion(prompt: string) {
      const run = (async () => {
        const sdk = await loadSdk();
        return sdk.completion({
          modelId,
          stream: true,
          history: [{ role: 'user', content: prompt }],
          generationParams: {
            temp: 0.2,
            predict: 96,
          },
        });
      })();

      return {
        events: (async function* () {
          const resolved = await run;
          yield* resolved.events;
        })(),
        final: run.then((resolved) => resolved.final).then((final) => final),
      } as unknown as CompletionRun;
    },
  };
}
