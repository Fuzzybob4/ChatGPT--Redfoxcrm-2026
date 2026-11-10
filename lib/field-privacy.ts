/**
 * Crew screens never show money. Office notes often carry payment details
 * ("balance $400.00", "Square invoice 000438", "paid deposit"), so any line or
 * sentence that talks about money or billing is dropped before a crew sees it.
 * The full note stays in the office app.
 */
const MONEY =
  /\$\s?\d|\b\d{1,3}(,\d{3})*\.\d{2}\b|\b(balance|paid|unpaid|payment|payments|invoice|invoiced|deposit|refund|price|priced|pricing|cost|costs|subtotal|tax|discount|charge|charged|owe|owes|owed|venmo|zelle|check\s?#)\b|\b(imported|migrat\w*|sync(ed)?\s+from)\b/i;

export function crewSafeText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .split(/\r?\n/)
    .map((line) =>
      line
        .split(/(?<=[.!?;])\s+/)
        .filter((sentence) => !MONEY.test(sentence))
        .join(" ")
        .trim(),
    )
    .filter(Boolean)
    .join("\n")
    .trim();
}

/** Install items are fine to show, unless an item line itself is a billing line. */
export function isCrewSafeItem(description: string | null | undefined): boolean {
  const d = (description ?? "").trim();
  return Boolean(d) && !MONEY.test(d) && !/^square\b/i.test(d);
}
