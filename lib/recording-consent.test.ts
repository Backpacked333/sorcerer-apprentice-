import { describe, expect, it, vi } from "vitest";
import { uploadWithConsentEpoch } from "./recording-consent";

describe("recording consent epoch", () => {
  it("discards an uploaded clip when consent changes during upload", async () => {
    let epoch = 0;
    let finishUpload!: () => void;
    const upload = vi.fn(() => new Promise<void>((resolve) => { finishUpload = resolve; }));
    const discard = vi.fn(async () => {});
    const saved = uploadWithConsentEpoch(0, () => epoch, upload, discard);

    epoch += 1;
    finishUpload();

    await expect(saved).resolves.toBe(false);
    expect(upload).toHaveBeenCalledOnce();
    expect(discard).toHaveBeenCalledOnce();
  });

  it("does not upload when consent changed before upload begins", async () => {
    const upload = vi.fn(async () => {});
    const discard = vi.fn(async () => {});

    await expect(uploadWithConsentEpoch(0, () => 1, upload, discard)).resolves.toBe(false);
    expect(upload).not.toHaveBeenCalled();
    expect(discard).not.toHaveBeenCalled();
  });

  it("attempts cleanup when an upload fails after consent is withdrawn", async () => {
    let epoch = 0;
    const upload = vi.fn(async () => {
      epoch += 1;
      throw new Error("connection closed");
    });
    const discard = vi.fn(async () => {});

    await expect(uploadWithConsentEpoch(0, () => epoch, upload, discard)).resolves.toBe(false);
    expect(discard).toHaveBeenCalledOnce();
  });
});
