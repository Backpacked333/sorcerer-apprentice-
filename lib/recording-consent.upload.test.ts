import { describe, expect, it, vi } from "vitest";
import { uploadRecordingWithConsent } from "./recording-consent";

const audio = new Blob(["recorded audio"], { type: "audio/webm" });

describe("voice-owned clip upload consent", () => {
  it("uploads WebM using the session clip contract", async () => {
    const request = vi.fn<typeof fetch>(async () => new Response(null, { status: 200 }));
    await expect(uploadRecordingWithConsent("capture", "answer", audio, 0, () => 0, request)).resolves.toBe(true);
    const [url, options] = request.mock.calls[0];
    expect(url).toBe("/api/sessions/capture/clips");
    expect(options?.method).toBe("POST");
    const form = options?.body as FormData;
    expect(form.get("audioId")).toBe("answer");
    expect((form.get("file") as File).type).toBe("audio/webm");
    expect(request).toHaveBeenCalledOnce();
  });

  it("does not upload when off-record precedes recorder shutdown", async () => {
    const request = vi.fn<typeof fetch>();
    await expect(uploadRecordingWithConsent("capture", "answer", audio, 0, () => 1, request)).resolves.toBe(false);
    expect(request).not.toHaveBeenCalled();
  });

  it("deletes a clip when off-record races the upload response", async () => {
    let epoch = 0;
    let finish!: (response: Response) => void;
    const request = vi.fn<typeof fetch>()
      .mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }))
      .mockResolvedValue(new Response(null, { status: 200 }));
    const saved = uploadRecordingWithConsent("capture", "answer", audio, 0, () => epoch, request);
    epoch++;
    finish(new Response(null, { status: 200 }));
    await expect(saved).resolves.toBe(false);
    expect(request).toHaveBeenLastCalledWith("/api/sessions/capture/clips?audioId=answer", { method: "DELETE" });
  });

  it("also deletes after an uncertain upload response when consent changed", async () => {
    let epoch = 0;
    const request = vi.fn<typeof fetch>()
      .mockImplementationOnce(async () => { epoch++; throw new Error("connection closed"); })
      .mockResolvedValue(new Response(null, { status: 200 }));
    await expect(uploadRecordingWithConsent("capture", "answer", audio, 0, () => epoch, request)).resolves.toBe(false);
    expect(request).toHaveBeenLastCalledWith("/api/sessions/capture/clips?audioId=answer", { method: "DELETE" });
  });

  it("reports rejected uploads rather than silently succeeding", async () => {
    const request = vi.fn<typeof fetch>(async () => new Response(null, { status: 413 }));
    await expect(uploadRecordingWithConsent("capture", "answer", audio, 0, () => 0, request)).rejects.toThrow("clip upload failed");
  });

  it("reports failed withdrawal rather than claiming evidence was discarded", async () => {
    let epoch = 0;
    const request = vi.fn<typeof fetch>()
      .mockImplementationOnce(async () => { epoch++; return new Response(null, { status: 200 }); })
      .mockResolvedValue(new Response(null, { status: 503 }));
    await expect(uploadRecordingWithConsent("capture", "answer", audio, 0, () => epoch, request)).rejects.toThrow("clip discard failed");
  });
});
