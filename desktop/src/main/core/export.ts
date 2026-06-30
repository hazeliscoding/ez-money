/** Minimal shape toCsv reads — satisfied by both the entity and shared Transaction. */
export interface CsvRow {
  date: string;
  period: string;
  description: string;
  category: string;
  kind: string;
  amount: number;
  account: string;
  notes: string;
}

const COLUMNS = [
  'date', 'period', 'description', 'category', 'kind', 'amount', 'account', 'notes',
] as const;

/** Escape one CSV field per RFC 4180 (quote when it contains "," CR/LF). */
function csvField(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Render transactions as CSV — a header row plus one row per transaction, using
 * CRLF line endings (Excel-friendly). Pure/deterministic so it's unit-testable.
 */
export function toCsv(rows: CsvRow[]): string {
  const header = COLUMNS.join(',');
  const body = rows.map((r) => COLUMNS.map((c) => csvField(r[c])).join(','));
  return [header, ...body].join('\r\n') + '\r\n';
}
