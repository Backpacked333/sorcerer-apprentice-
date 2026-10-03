export async function uploadWithConsentEpoch(
  expectedEpoch: number,
  currentEpoch: () => number,
  upload: () => Promise<void>,
  discard: () => Promise<void>,
): Promise<boolean> {
  if (currentEpoch() !== expectedEpoch) return false;
  try {
    await upload();
  } catch (error) {
    if (currentEpoch() !== expectedEpoch) {
      await discard();
      return false;
    }
    throw error;
  }
  if (currentEpoch() !== expectedEpoch) {
    await discard();
    return false;
  }
  return true;
}
