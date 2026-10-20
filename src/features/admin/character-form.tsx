"use client";

import { useActionState, useId } from "react";
import { Field, SubmitButton } from "@/components/ui/form";
import { saveCharacter } from "./actions";
import { GEMINI_VOICES, GENDER_LABEL, type CharacterRow } from "./characters";

const selectClass = "min-h-11 rounded-sm border border-rule bg-paper px-3 text-base text-ink outline-none focus:border-ink";
const labelClass = "font-mono text-label uppercase text-ink-2";

/** US-A-03: one form for "add" (no character) and "edit" (id fixed: scenarios point at it). */
export function CharacterForm({ character }: { character?: CharacterRow }) {
  const [state, action] = useActionState(saveCharacter, undefined);
  const uid = useId();
  const f = (name: string) => `${uid}-${name}`;

  return (
    <form action={action} className="mt-4 grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="mode" value={character ? "edit" : "new"} />
      {character ? (
        <input type="hidden" name="id" value={character.id} />
      ) : (
        <Field id={f("id")} label="ID (slug)" name="id" required pattern="[a-z0-9\-]{2,40}" hint="Huruf kecil, angka, tanda hubung. Tidak bisa diubah." />
      )}
      <Field id={f("name")} label="Nama" name="name" required maxLength={60} defaultValue={character?.name} />
      <Field id={f("occupation")} label="Pekerjaan" name="occupation" required maxLength={80} defaultValue={character?.occupation} />
      <Field id={f("age")} label="Rentang usia" name="age_range" required maxLength={20} placeholder="mis. 40-an" defaultValue={character?.age_range} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={f("gender")} className={labelClass}>
          Gender
        </label>
        <select id={f("gender")} name="gender" required defaultValue={character?.gender ?? "female"} className={selectClass}>
          {Object.entries(GENDER_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={f("voice")} className={labelClass}>
          Suara Gemini
        </label>
        <select id={f("voice")} name="live_voice" required defaultValue={character?.live_voice ?? GEMINI_VOICES[0]} className={selectClass}>
          {GEMINI_VOICES.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </div>
      <Field id={f("hue")} label="Warna potret (0–359)" name="portrait_hue" type="number" required min={0} max={359} defaultValue={character?.portrait_hue ?? 30} />
      <Field id={f("sort")} label="Urutan" name="sort" type="number" required min={0} max={999} defaultValue={character?.sort ?? 0} />
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <SubmitButton pending="Menyimpan…">{character ? "Simpan perubahan" : "Tambah karakter"}</SubmitButton>
        {state?.error && (
          <p role="alert" className="text-sm text-accent">
            {state.error}
          </p>
        )}
        {state?.ok && (
          <p role="status" className="text-sm text-moss">
            Tersimpan.
          </p>
        )}
      </div>
    </form>
  );
}
