export function formatRecoveryKey(value: string, chunkSize = 22): string {
  const normalizedChunkSize = Math.max(1, Math.floor(chunkSize));
  const chunks = value.match(new RegExp(`.{1,${normalizedChunkSize}}`, 'g')) ?? [];
  return chunks.join('\n');
}
