import { randomInt } from "node:crypto";
import { USERNAME_PATTERN } from "@/features/auth/identifier";

export const MAX_BULK_ROWS = 500;

export type StudentRow = { line: number; name: string; username: string };
export type RejectedRow = { line: number; raw: string; reason: string };

/** Minimal RFC 4180 line splitter: commas or semicolons (Excel ID locale), double-quoted fields. */
function splitCsvLine(line: string): string[] {
  const delimiter = line.includes(";") && !line.includes(",") ? ";" : ",";
  const out: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      out.push(field);
      field = "";
    } else field += ch;
  }
  out.push(field);
  return out.map((f) => f.trim());
}

/**
 * Parses "nama,username" rows (header optional). Validates each row independently so one bad
 * row never blocks the rest (US-G-02). `taken` = usernames already in the database.
 */
export function parseStudentCsv(text: string, taken: ReadonlySet<string> = new Set()) {
  const rows: StudentRow[] = [];
  const rejected: RejectedRow[] = [];
  const seen = new Set<string>();
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);

  lines.forEach((raw, idx) => {
    const line = idx + 1;
    if (!raw.trim()) return;
    const [nameRaw = "", usernameRaw = ""] = splitCsvLine(raw);
    if (idx === 0 && /^nama$/i.test(nameRaw) && /^username$/i.test(usernameRaw)) return;

    const name = nameRaw.replace(/\s+/g, " ");
    const username = usernameRaw.toLowerCase();
    const reject = (reason: string) => rejected.push({ line, raw, reason });

    if (!name || name.length > 80) return reject("Nama wajib diisi (maks. 80 karakter)");
    if (!USERNAME_PATTERN.test(username))
      return reject("Username 3–32 karakter: huruf kecil, angka, titik, atau garis bawah");
    if (seen.has(username)) return reject("Username ganda di file ini");
    if (taken.has(username)) return reject("Username sudah dipakai");
    seen.add(username);
    rows.push({ line, name, username });
  });

  if (rows.length > MAX_BULK_ROWS) {
    for (const r of rows.splice(MAX_BULK_ROWS)) {
      rejected.push({ line: r.line, raw: `${r.name},${r.username}`, reason: `Melebihi batas ${MAX_BULK_ROWS} baris` });
    }
  }
  return { rows, rejected };
}

// No 0/O/1/l/I so passwords read off a printed sheet aren't mistyped.
const PASSWORD_ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateInitialPassword(length = 12): string {
  let out = "";
  for (let i = 0; i < length; i++) out += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  return out;
}
