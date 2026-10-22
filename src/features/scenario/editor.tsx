"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ComponentProps, type ReactNode } from "react";
import { buttonClass } from "@/components/ui/button-class";
import { Notice } from "@/components/ui/form";
import { Avatar } from "@/features/avatar/avatar";
import { generateDraft, publishScenario, saveDraft, setScenarioPublic } from "./actions";
import { CharacterPortrait } from "./character-portrait";
import { FACT_CATEGORIES, LANGUAGES, LEVELS, publishProblems, renumberFacts, type ScenarioDraft } from "./schema";

export type EditorCharacter = {
  id: string;
  name: string;
  occupation: string;
  age_range: string;
  gender: string;
  live_voice: string;
  portrait_hue: number;
  vrm_url: string | null;
};

type Fact = NonNullable<ScenarioDraft["facts"]>[number];
type Criterion = NonNullable<ScenarioDraft["rubric"]>[number];
type SaveState = { kind: "idle" | "saving" | "saved" | "error"; at?: string; error?: string };

const SECTIONS = [
  ["brief", "Brief & AI"],
  ["persona", "Persona"],
  ["fakta", "Fakta tersembunyi"],
  ["rubrik", "Rubrik"],
  ["karakter", "Karakter"],
  ["terbit", "Terbitkan"],
] as const;

const inputCls =
  "w-full rounded-sm border border-rule bg-paper px-3 py-2.5 text-base text-ink transition-colors placeholder:text-ink-2/60 focus:border-ink focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";
// Textareas grow with their content (no clipped facts on mobile).
const areaCls = `${inputCls} field-sizing-content min-h-20 max-h-96`;

function Label({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block font-mono text-label uppercase text-ink-2">
      {children}
    </label>
  );
}

function TextInput({ id, label, ...rest }: ComponentProps<"input"> & { id: string; label: string }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <input id={id} className={`${inputCls} min-h-11`} {...rest} />
    </div>
  );
}

function TextArea({ id, label, ...rest }: ComponentProps<"textarea"> & { id: string; label: string }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <textarea id={id} className={areaCls} {...rest} />
    </div>
  );
}

function Select({ id, label, options, ...rest }: ComponentProps<"select"> & { id: string; label: string; options: Record<string, string> }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <select id={id} className={`${inputCls} min-h-11`} {...rest}>
        {Object.entries(options).map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}

/** 1–3 scale as a compact segmented radio group (weight / difficulty). */
function Scale({ name, label, value, onChange, hint }: { name: string; label: string; value?: number; onChange: (v: number) => void; hint: [string, string, string] }) {
  return (
    <fieldset>
      <legend className="mb-1.5 font-mono text-label uppercase text-ink-2">{label}</legend>
      <div className="flex gap-1">
        {[1, 2, 3].map((n) => (
          <label
            key={n}
            title={hint[n - 1]}
            className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-sm border border-rule font-mono text-sm has-checked:border-ink has-checked:bg-ink has-checked:text-paper has-focus-visible:outline-2 has-focus-visible:outline-accent"
          >
            <input type="radio" name={name} value={n} checked={value === n} onChange={() => onChange(n)} className="sr-only" />
            <span aria-hidden>{"●".repeat(n)}</span>
            <span className="sr-only">{hint[n - 1]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Section({ id, n, title, children, intro }: { id: string; n: number; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 border-t border-rule pt-8 pb-12">
      <p className="font-mono text-label uppercase text-accent">{String(n).padStart(2, "0")}</p>
      <h2 id={`${id}-h`} className="mt-2 font-display text-3xl font-medium tracking-tight">
        {title}
      </h2>
      {intro && <p className="mt-2 max-w-2xl text-ink-2">{intro}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

const emptyFact = (): Fact => ({ category: "fungsional", content: "", weight: 2, difficulty: 2, triggerHint: "" });
const emptyCriterion = (): Criterion => ({ criterion: "", weight: 1, descriptors: { 1: "", 2: "", 3: "", 4: "" } });

export function ScenarioEditor({
  id,
  initialDraft,
  characters,
  published,
}: {
  id: string;
  initialDraft: ScenarioDraft;
  characters: EditorCharacter[];
  published: { id: string; version: number; isPublic: boolean } | null;
}) {
  const [draft, setDraft] = useState<ScenarioDraft>(initialDraft);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [factCount, setFactCount] = useState(10);
  const [aiError, setAiError] = useState<string>();
  const [publishMsg, setPublishMsg] = useState<{ ok: boolean; text: string; problems?: string[] }>();
  const [previewing, setPreviewing] = useState<string>();
  const chosen = characters.find((c) => c.id === draft.characterId);
  const [generating, startGenerate] = useTransition();
  const [publishing, startPublish] = useTransition();

  const dirty = useRef(false);
  const latest = useRef(draft);
  useEffect(() => {
    latest.current = draft; // declared before the autosave effect, so flush() always sees the newest draft
  }, [draft]);

  const update = useCallback((patch: Partial<ScenarioDraft>) => {
    dirty.current = true;
    setDraft((d) => ({ ...d, ...patch }));
  }, []);
  const setPersona = (patch: NonNullable<ScenarioDraft["persona"]>) => update({ persona: { ...draft.persona, ...patch } });
  const facts = draft.facts ?? [];
  const rubric = draft.rubric ?? [];
  const setFacts = (next: Fact[]) => update({ facts: renumberFacts(next) });
  const setRubric = (next: Criterion[]) => update({ rubric: next });

  const flush = useCallback(async () => {
    if (!dirty.current) return true;
    dirty.current = false;
    setSave({ kind: "saving" });
    const res = await saveDraft(id, latest.current);
    setSave(res.ok ? { kind: "saved", at: res.savedAt } : { kind: "error", error: res.error });
    if (!res.ok) dirty.current = true;
    return res.ok;
  }, [id]);

  // Autosave ~1 s after the last edit.
  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(flush, 1000);
    return () => clearTimeout(t);
  }, [draft, flush]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const characterIds = useMemo(() => characters.map((c) => c.id), [characters]);
  const problems = useMemo(
    () => publishProblems({ ...draft, facts: renumberFacts(draft.facts ?? []) }, characterIds),
    [draft, characterIds],
  );

  function generate() {
    setAiError(undefined);
    const hasContent = facts.length > 0 || Boolean(draft.persona?.name);
    if (hasContent && !window.confirm("Draf AI akan menimpa persona, fakta, dan rubrik yang sudah ada. Lanjutkan?")) return;
    startGenerate(async () => {
      await flush();
      const res = await generateDraft(id, {
        summary: draft.summary ?? "",
        language: draft.language ?? "id",
        level: draft.level ?? "smk",
        factCount,
      });
      if (res.ok) {
        dirty.current = false;
        setDraft(res.draft);
        setSave({ kind: "saved", at: new Date().toISOString() });
      } else setAiError(res.error);
    });
  }

  function publish() {
    setPublishMsg(undefined);
    startPublish(async () => {
      if (!(await flush())) return;
      const res = await publishScenario(id);
      setPublishMsg(
        res.ok
          ? { ok: true, text: res.version === 1 ? "Terbit sebagai versi 1. Sekarang bisa diberikan ke kelas." : `Terbit sebagai versi ${res.version}. Tugas yang sudah dibuat tetap memakai versi lamanya.` }
          : { ok: false, text: "Belum bisa terbit:", problems: res.problems },
      );
    });
  }

  const saveLabel =
    save.kind === "saving"
      ? "Menyimpan…"
      : save.kind === "error"
        ? save.error
        : save.kind === "saved" && save.at
          ? `Tersimpan ${new Date(save.at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`
          : "Draf tersimpan otomatis";

  return (
    <div className="grid gap-10 lg:grid-cols-[13rem_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <p role="status" className={`font-mono text-label uppercase ${save.kind === "error" ? "text-accent" : "text-ink-2"}`}>
          {saveLabel}
        </p>
        <nav aria-label="Bagian editor" className="mt-4 hidden lg:block">
          <ol className="flex flex-col gap-1 text-sm">
            {SECTIONS.map(([sid, label], i) => (
              <li key={sid}>
                <a href={`#${sid}`} className="flex min-h-9 items-center gap-3 text-ink-2 hover:text-ink">
                  <span className="font-mono text-label">{String(i + 1).padStart(2, "0")}</span>
                  {label}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        {published && (
          <p className="mt-6 font-mono text-label uppercase text-moss">
            Terbit v{published.version}
            {published.isPublic && " · Publik"}
          </p>
        )}
      </aside>

      <div className="min-w-0">
        <Section id="brief" n={1} title="Brief & AI" intro="Tulis situasinya dalam beberapa kalimat. AI menyiapkan persona, fakta tersembunyi, dan rubrik, lalu Anda bisa mengubah semuanya.">
          <div className="grid gap-5">
            <TextArea
              id="summary"
              label="Ringkasan untuk AI"
              rows={4}
              maxLength={1000}
              placeholder="mis. Pemilik laundry kiloan di Manado ingin aplikasi antar-jemput. Kurirnya sedikit dan pelanggan sering komplain soal jadwal."
              value={draft.summary ?? ""}
              onChange={(e) => update({ summary: e.target.value })}
            />
            <div className="grid gap-5 sm:grid-cols-3">
              <Select id="language" label="Bahasa wawancara" options={LANGUAGES} value={draft.language ?? "id"} onChange={(e) => update({ language: e.target.value as "id" | "en" })} />
              <Select id="level" label="Tingkat" options={LEVELS} value={draft.level ?? "smk"} onChange={(e) => update({ level: e.target.value as "smk" | "s1" | "umum" })} />
              <TextInput id="factCount" label="Jumlah fakta" type="number" min={6} max={15} value={factCount} onChange={(e) => setFactCount(Number(e.target.value))} />
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <button type="button" onClick={generate} disabled={generating || (draft.summary ?? "").trim().length < 20} className={buttonClass("accent")} aria-busy={generating}>
                {generating ? "AI sedang menyusun… (±30 detik)" : "Buat draf dengan AI"}
              </button>
              {(draft.summary ?? "").trim().length < 20 && <span className="text-sm text-ink-2">Ringkasan minimal 20 karakter.</span>}
            </div>
            {aiError && <Notice>{aiError}</Notice>}
            <hr className="border-rule" />
            <TextInput id="title" label="Judul skenario" maxLength={120} value={draft.title ?? ""} onChange={(e) => update({ title: e.target.value })} />
            <TextInput id="learnerRole" label="Peran pelajar" maxLength={200} placeholder="mis. Analis sistem dari software house" value={draft.learnerRole ?? ""} onChange={(e) => update({ learnerRole: e.target.value })} />
            <TextArea id="objective" label="Tujuan wawancara (dilihat pelajar)" maxLength={500} value={draft.objective ?? ""} onChange={(e) => update({ objective: e.target.value })} />
          </div>
        </Section>

        <Section id="persona" n={2} title="Persona" intro="Siapa yang diwawancarai. Nama dan pekerjaan terlihat oleh pelajar; sisanya hanya untuk AI.">
          <div className="grid gap-5 sm:grid-cols-2">
            <TextInput id="p-name" label="Nama klien" maxLength={80} value={draft.persona?.name ?? ""} onChange={(e) => setPersona({ name: e.target.value })} />
            <TextInput id="p-occupation" label="Pekerjaan" maxLength={120} value={draft.persona?.occupation ?? ""} onChange={(e) => setPersona({ occupation: e.target.value })} />
            <TextInput id="p-age" label="Usia" type="number" min={15} max={90} value={draft.persona?.age ?? ""} onChange={(e) => setPersona({ age: e.target.value === "" ? undefined : Number(e.target.value) })} />
            <TextInput id="p-opening" label="Kalimat pembuka" maxLength={300} value={draft.persona?.openingLine ?? ""} onChange={(e) => setPersona({ openingLine: e.target.value })} />
            <div className="sm:col-span-2">
              <TextArea id="p-bg" label="Latar belakang" rows={4} maxLength={1200} value={draft.persona?.background ?? ""} onChange={(e) => setPersona({ background: e.target.value })} />
            </div>
            <TextArea id="p-style" label="Gaya bicara" maxLength={300} value={draft.persona?.speakingStyle ?? ""} onChange={(e) => setPersona({ speakingStyle: e.target.value })} />
            <TextArea id="p-attitude" label="Sikap" maxLength={300} value={draft.persona?.attitude ?? ""} onChange={(e) => setPersona({ attitude: e.target.value })} />
          </div>
        </Section>

        <Section id="fakta" n={3} title="Fakta tersembunyi" intro="Hal yang hanya diungkap klien bila ditanya dengan tepat. Tidak pernah terlihat oleh pelajar sebelum tenggat.">
          <ol className="flex flex-col gap-4">
            {facts.map((f, i) => {
              const patch = (p: Partial<Fact>) => setFacts(facts.map((x, j) => (j === i ? { ...x, ...p } : x)));
              return (
                <li key={i} className="rounded-md border border-rule bg-paper p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-label text-accent">F{i + 1}</span>
                    <button type="button" onClick={() => setFacts(facts.filter((_, j) => j !== i))} className="min-h-11 px-2 text-sm text-ink-2 hover:text-accent">
                      Hapus<span className="sr-only"> fakta F{i + 1}</span>
                    </button>
                  </div>
                  <div className="mt-2 grid gap-4">
                    <TextArea id={`f${i}-content`} label="Isi fakta" rows={2} maxLength={400} value={f.content ?? ""} onChange={(e) => patch({ content: e.target.value })} />
                    <TextInput id={`f${i}-trigger`} label="Terungkap bila ditanya…" maxLength={200} value={f.triggerHint ?? ""} onChange={(e) => patch({ triggerHint: e.target.value })} />
                    <div className="flex flex-wrap items-end gap-5">
                      <div className="min-w-44">
                        <Select id={`f${i}-cat`} label="Kategori" options={FACT_CATEGORIES} value={f.category ?? "fungsional"} onChange={(e) => patch({ category: e.target.value as Fact["category"] })} />
                      </div>
                      <Scale name={`f${i}-w`} label="Bobot" value={f.weight} onChange={(v) => patch({ weight: v })} hint={["Bobot rendah", "Bobot sedang", "Bobot tinggi"]} />
                      <Scale name={`f${i}-d`} label="Kesulitan" value={f.difficulty} onChange={(v) => patch({ difficulty: v })} hint={["Muncul bila topik disinggung", "Perlu ditanya langsung", "Perlu digali lebih dalam"]} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          <button type="button" disabled={facts.length >= 20} onClick={() => setFacts([...facts, emptyFact()])} className={buttonClass("ghost", "mt-4")}>
            + Tambah fakta
          </button>
        </Section>

        <Section id="rubrik" n={4} title="Rubrik" intro="Kriteria kualitas wawancara, level 1 (kurang) sampai 4 (sangat baik). Nilai akhir: 60% cakupan fakta + 40% rubrik.">
          <ol className="flex flex-col gap-4">
            {rubric.map((c, i) => {
              const patch = (p: Partial<Criterion>) => setRubric(rubric.map((x, j) => (j === i ? { ...x, ...p } : x)));
              return (
                <li key={i} className="rounded-md border border-rule bg-paper p-4">
                  <div className="grid gap-4 sm:grid-cols-[1fr_7rem_auto] sm:items-end">
                    <TextInput id={`r${i}-name`} label={`Kriteria ${i + 1}`} maxLength={80} value={c.criterion ?? ""} onChange={(e) => patch({ criterion: e.target.value })} />
                    <TextInput id={`r${i}-w`} label="Bobot" type="number" min={1} max={5} value={c.weight ?? 1} onChange={(e) => patch({ weight: Number(e.target.value) })} />
                    <button type="button" onClick={() => setRubric(rubric.filter((_, j) => j !== i))} className="min-h-11 px-2 text-sm text-ink-2 hover:text-accent">
                      Hapus<span className="sr-only"> kriteria {i + 1}</span>
                    </button>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {([1, 2, 3, 4] as const).map((lvl) => (
                      <TextInput
                        key={lvl}
                        id={`r${i}-d${lvl}`}
                        label={`Level ${lvl}`}
                        maxLength={200}
                        value={c.descriptors?.[lvl] ?? ""}
                        onChange={(e) => patch({ descriptors: { ...c.descriptors, [lvl]: e.target.value } })}
                      />
                    ))}
                  </div>
                </li>
              );
            })}
          </ol>
          <button type="button" disabled={rubric.length >= 8} onClick={() => setRubric([...rubric, emptyCriterion()])} className={buttonClass("ghost", "mt-4")}>
            + Tambah kriteria
          </button>
        </Section>

        <Section id="karakter" n={5} title="Karakter" intro="Wujud 3D dan suara yang memerankan persona. Suara melekat pada karakter.">
          <fieldset>
            <legend className="sr-only">Pilih karakter</legend>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {characters.map((c) => (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-4 rounded-md border border-rule p-3 transition-colors hover:border-ink has-checked:border-ink has-checked:bg-paper-2 has-focus-visible:outline-2 has-focus-visible:outline-accent"
                >
                  <input type="radio" name="character" value={c.id} checked={draft.characterId === c.id} onChange={() => update({ characterId: c.id })} className="sr-only" />
                  <CharacterPortrait name={c.name} hue={c.portrait_hue} size="sm" />
                  <span className="min-w-0">
                    <span className="block font-display text-lg leading-tight">{c.name}</span>
                    <span className="block text-sm text-ink-2">{c.occupation}</span>
                    <span className="block font-mono text-label uppercase text-ink-2">
                      {c.age_range} · suara {c.live_voice}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {chosen?.vrm_url && (
            <div className="mt-6">
              {/* US-G-05: three.js loads only after this click, so the editor's own bundle stays small. */}
              {/* One toggle button for open and close, so keyboard focus never jumps. */}
              <button
                type="button"
                aria-expanded={previewing === chosen.id}
                onClick={() => setPreviewing(previewing === chosen.id ? undefined : chosen.id)}
                className={buttonClass("ghost")}
              >
                {previewing === chosen.id ? "Tutup pratinjau" : `Lihat animasi ${chosen.name}`}
              </button>
              {previewing === chosen.id && (
                <div className="mt-3 h-80 w-full max-w-sm overflow-hidden rounded-md border border-rule bg-paper-2">
                  <Avatar
                    url={chosen.vrm_url}
                    pose="idle"
                    portrait={
                      <div className="grid size-full place-items-center">
                        <CharacterPortrait name={chosen.name} hue={chosen.portrait_hue} size="lg" />
                      </div>
                    }
                  />
                </div>
              )}
            </div>
          )}
        </Section>

        <Section id="terbit" n={6} title="Terbitkan" intro="Setiap terbit membuat versi baru. Tugas yang sudah diberikan tetap memakai versi saat tugas dibuat.">
          {problems.length > 0 ? (
            <div className="border-l-2 border-ochre pl-4">
              <p className="font-mono text-label uppercase text-ochre">{problems.length} hal perlu dilengkapi</p>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {problems.slice(0, 12).map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          ) : (
            <Notice tone="ok">Skenario lengkap dan siap terbit.</Notice>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {published && (
              <a href={`/sesi/mulai?versi=${published.id}&jenis=preview`} className={buttonClass("ghost")}>
                Uji coba v{published.version}
              </a>
            )}
            <button type="button" onClick={publish} disabled={publishing || problems.length > 0} className={buttonClass("primary")} aria-busy={publishing}>
              {publishing ? "Menerbitkan…" : published ? `Terbitkan versi ${published.version + 1}` : "Terbitkan"}
            </button>
          </div>
          {publishMsg && (
            <div className="mt-4">
              <Notice tone={publishMsg.ok ? "ok" : "error"}>{publishMsg.text}</Notice>
              {publishMsg.problems && (
                <ul className="mt-2 text-sm">
                  {publishMsg.problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {published && (
            <form action={setScenarioPublic} className="mt-8 border-t border-rule pt-6">
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="public" value={String(!published.isPublic)} />
              <p className="text-ink-2">
                {published.isPublic
                  ? "Versi terbaru tampil di Pustaka: pengajar lain bisa memberikannya ke kelas, pelajar bisa berlatih."
                  : "Bagikan ke Pustaka agar pengajar lain bisa memakai skenario ini. Fakta & rubrik tetap tersembunyi dari pelajar."}
              </p>
              <button type="submit" className={buttonClass("ghost", "mt-3")}>
                {published.isPublic ? "Tarik dari Pustaka" : "Bagikan ke Pustaka"}
              </button>
            </form>
          )}
        </Section>
      </div>
    </div>
  );
}
