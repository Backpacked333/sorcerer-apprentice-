export async function uploadRecordingWithConsent(
  sessionId: string,
  audioId: string,
  blob: Blob,
  expectedEpoch: number,
  currentEpoch: () => number,
  request: typeof fetch = fetch,
): Promise<boolean> {
  const url = `/api/sessions/${encodeURIComponent(sessionId)}/clips`;
  const form = new FormData();
  form.append("audioId", audioId);
  form.append("file", blob, `${audioId}.webm`);
  return uploadWithConsentEpoch(expectedEpoch, currentEpoch, async () => {
    const response = await request(url, { method: "POST", body: form });
    if (!response.ok) throw new Error("clip upload failed");
  }, async () => {
    const response = await request(`${url}?audioId=${encodeURIComponent(audioId)}`, { method: "DELETE" });
    if (!response.ok) throw new Error("clip discard failed");
  });
}

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
