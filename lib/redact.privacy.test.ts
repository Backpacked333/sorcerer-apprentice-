import { describe, expect, it } from "vitest";
import { redactText } from "./redact";

describe("text privacy without destroying invoice evidence", () => {
  it.each(["invoices 4471 4472 4473", "0400 4120 4300", "PO-88213", "€7,850", "1234 5678 9012 3456"])("preserves %s", (text) => {
    expect(redactText(text)).toEqual({ text, entities: [] });
  });
  it.each(["+49 711 123456", "0711 123456", "0711123456", "030 12345", "(0711) 123456", "+1 (212) 555-0199", "212-555-0199", "(212) 555-0199"])("masks phone %s", (text) => {
    expect(redactText(text).text).toBe("[phone]");
  });
  it.each([
    ["DE89 3704 0044 0532 0130 00", "iban"], ["s.koch@example.de", "email"],
    ["DE123456789", "vat_id"], ["12/345/67890", "tax_number"],
    ["4111 1111 1111 1111", "card"], ["4111111111111111", "card"],
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
});
