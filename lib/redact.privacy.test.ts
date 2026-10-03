import { describe, expect, it } from "vitest";
import { redactText } from "./redact";

describe("text privacy without destroying invoice evidence", () => {
  it.each(["invoices 4471 4472 4473", "0400 4120 4300", "0400\u00a04120\u00a04300", "PO-88213", "€7,850", "1234 5678 9012 3456", "1234 5678 9012 3456 123"])("preserves %s", (text) => {
    expect(redactText(text)).toEqual({ text, entities: [] });
  });
  it.each(["+49 711 123456", "0711 123456", "0711123456", "030 12345", "(0711) 123456", "+1 (212) 555-0199", "212-555-0199", "212 555 0199", "(212) 555-0199"])("masks phone %s", (text) => {
    expect(redactText(text).text).toBe("[phone]");
  });
  it.each([
    ["DE89 3704 0044 0532 0130 00", "iban"], ["s.koch@example.de", "email"],
    ["DE123456789", "vat_id"], ["12/345/67890", "tax_number"],
    ["4111 1111 1111 1111", "card"], ["4111111111111111", "card"], ["3782 822463 10005", "card"],
  ])("still masks %s as %s", (text, kind) => {
    expect(redactText(text).text).toBe(`[${kind}]`);
  });
  it("masks only caller-supplied whole names, including Unicode and regex punctuation", () => {
    const text = "Ask Élodie Noël or A. Li, not LiDAR. ÉLODIE NOËL agreed.";
    expect(redactText(text).text).toBe(text);
    const redacted = redactText(text, [" Élodie Noël ", "A. Li", "Li"]);
    expect(redacted.text).toBe("Ask [person] or [person], not LiDAR. [person] agreed.");
    expect(redactText(redacted.text, ["Élodie Noël", "A. Li"]).text).toBe(redacted.text);
  });
  it.each(["+49 711 123456", "0711 123456", "+1 (212) 555-0199", "+44 20 7946 0958"])("preserves business numbers after %s", (phone) => {
    expect(redactText(`Call ${phone} 4471 4472 0400 4120 4300`).text).toBe("Call [phone] 4471 4472 0400 4120 4300");
    expect(redactText(`Call ${phone} 4471`).text).toBe("Call [phone] 4471");
  });
  it("does not treat a supplied single initial as every article in ordinary prose", () => {
    expect(redactText("A reviewer approved it; I agreed", ["A", "I"]).text).toBe("A reviewer approved it; I agreed");
  });
  it.each(["(212)555-0199", "+49\u00a0711\u00a0123456", "(212)555\u00a00199"])("masks compact/NBSP phone %s without consuming business numbers", (phone) => {
    expect(redactText(phone).text).toBe("[phone]");
    expect(redactText(`${phone} 4471 4472 0400`).text).toBe("[phone] 4471 4472 0400");
    expect(redactText(`${phone}\u00a04471\u00a04472\u00a00400`).text).toBe("[phone]\u00a04471\u00a04472\u00a00400");
  });
  it.each([" ", "-"])("retains a trailing three-digit business value after a valid card (%s)", (separator) => {
    const card = "4111 1111 1111 1111";
    expect(redactText(`${card}${separator}123`)).toEqual({ text: `[card]${separator}123`, entities: [{ kind: "card", original: card }] });
  });
  it("still masks a complete Luhn-valid 19-digit card", () => {
    const card = "4000 0000 0000 0000 006";
    expect(redactText(card)).toEqual({ text: "[card]", entities: [{ kind: "card", original: card }] });
  });
});
