"use client";

import { useActionState, useState } from "react";
import { Field, Notice, SubmitButton } from "@/components/ui/form";
import { bulkCreateStudents, createClass, joinClass } from "./actions";
import { csvCell } from "./csv-cell";

export function CreateClassForm() {
  const [state, action] = useActionState(createClass, undefined);
  return (
    <form action={action} className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div className="flex-1">
        <Field label="Nama kelas baru" name="name" placeholder="mis. RPL XI-1 Analisis Kebutuhan" required maxLength={80} error={state?.fieldErrors?.name} defaultValue={state?.values?.name} />
      </div>
      <SubmitButton variant="accent" pending="Membuat…" className="sm:mt-6">
        Buat kelas
      </SubmitButton>
      {state?.error && <Notice>{state.error}</Notice>}
    </form>
  );
}

export function JoinClassForm() {
  const [state, action] = useActionState(joinClass, undefined);
  return (
    <form action={action} className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div className="flex-1">
        <Field
          label="Kode kelas"
          name="code"
          placeholder="mis. K7RM2Q"
          required
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={8}
          className="min-h-11 w-full rounded-sm border border-rule bg-paper px-3 font-mono text-lg uppercase tracking-[0.2em] text-ink outline-none focus:border-ink aria-invalid:border-accent"
          error={state?.fieldErrors?.code}
          defaultValue={state?.values?.code}
        />
      </div>
      <SubmitButton variant="accent" pending="Bergabung…" className="sm:mt-6">
        Gabung
      </SubmitButton>
    </form>
  );
}

export function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
      className="min-h-11 rounded-sm border border-rule px-4 text-sm hover:border-ink"
    >
      <span aria-live="polite">{copied ? "Tersalin ✓" : "Salin kode"}</span>
    </button>
  );
}

function downloadPasswords(rows: { name: string; username: string; password: string }[]) {
  const body = ["nama,username,password_awal", ...rows.map((r) => [r.name, r.username, r.password].map(csvCell).join(","))].join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + body], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: "akun-pelajar.csv" });
  a.click();
  URL.revokeObjectURL(url);
}

export function BulkStudentsForm({ classId }: { classId: string }) {
  const [state, action] = useActionState(bulkCreateStudents, undefined);
  const created = state?.created ?? [];
  const rejected = state?.rejected ?? [];

  return (
    <div className="flex flex-col gap-6">
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="classId" value={classId} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="bulk-text" className="font-mono text-label uppercase text-ink-2">
            Daftar pelajar (nama,username per baris)
          </label>
          <textarea
            id="bulk-text"
            name="text"
            rows={5}
            placeholder={"Budi Santoso,budi.s\nSiti Aminah,siti_01"}
            defaultValue={state?.text}
            className="rounded-sm border border-rule bg-paper p-3 font-mono text-sm outline-none focus:border-ink"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="bulk-file" className="font-mono text-label uppercase text-ink-2">
            …atau unggah CSV
          </label>
          <input id="bulk-file" name="file" type="file" accept=".csv,text/csv" className="text-sm file:mr-3 file:min-h-11 file:rounded-sm file:border file:border-rule file:bg-paper file:px-4 file:text-ink" />
        </div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="consent" className="mt-1 size-4 accent-[var(--color-accent)]" />
          <span>
            Saya mengonfirmasi institusi telah memperoleh persetujuan orang tua/wali untuk pelajar di bawah umur.
          </span>
        </label>
        {state?.error && <Notice>{state.error}</Notice>}
        <SubmitButton pending="Membuat akun…" className="self-start">
          Buat akun pelajar
        </SubmitButton>
      </form>

      {created.length > 0 && (
        <section aria-labelledby="created-h" className="border-t border-rule pt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h3 id="created-h" className="font-display text-xl">
              {created.length} akun dibuat
            </h3>
            <button type="button" onClick={() => downloadPasswords(created)} className="min-h-11 rounded-sm bg-ink px-4 text-sm text-paper hover:bg-accent">
              Unduh daftar password (CSV)
            </button>
          </div>
          <Notice tone="info">Password awal hanya ditampilkan sekali ini. Unduh atau catat sekarang.</Notice>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="font-mono text-label uppercase text-ink-2">
                <tr>
                  <th className="py-2 pr-4 font-normal">Nama</th>
                  <th className="py-2 pr-4 font-normal">Username</th>
                  <th className="py-2 font-normal">Password awal</th>
                </tr>
              </thead>
              <tbody>
                {created.map((r) => (
                  <tr key={r.username} className="border-t border-rule">
                    <td className="py-2 pr-4">{r.name}</td>
                    <td className="py-2 pr-4 font-mono">{r.username}</td>
                    <td className="py-2 font-mono">{r.password}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {rejected.length > 0 && (
        <section aria-labelledby="rejected-h" className="border-t border-rule pt-5">
          <h3 id="rejected-h" className="font-display text-xl">
            {rejected.length} baris dilewati
          </h3>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {rejected.map((r) => (
              <li key={`${r.line}-${r.raw}`}>
                <span className="font-mono text-ink-2">baris {r.line}</span> · <span className="font-mono">{r.raw || "(kosong)"}</span> — {r.reason}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
