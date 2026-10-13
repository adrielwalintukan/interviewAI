# AGENTS.md — Panduan Kerja Agent Interview AI

## 1. Tujuan

File ini adalah **entry point kerja agent** (Claude Code, Codex, Copilot, dan sejenisnya) untuk repository **Interview AI**, platform latihan wawancara elisitasi kebutuhan dengan karakter AI 3D, untuk sekolah dan kampus.

`AGENTS.md` mengarahkan agent agar:

- bekerja dari source of truth yang benar (`docs/`);
- membaca dokumen yang relevan sebelum implementasi atau review;
- menjaga scope, Git, database, secret, dan data pelajar;
- memverifikasi hasil sebelum menyatakan selesai;
- tidak mengklaim completion melebihi evidence.

`AGENTS.md` **tidak menduplikasi** aturan detail yang sudah ada di `docs/`. Kalau detail teknis, domain, arsitektur, UI, testing, atau workflow sudah ditetapkan di sana, **ikuti dokumen tersebut**.

Urutan prioritas instruksi: sistem/developer → instruksi eksplisit pengguna terbaru → `AGENTS.md` → dokumen `docs/` → kebiasaan umum agent.

Gunakan **Bahasa Indonesia** untuk komunikasi, laporan, dokumentasi, deskripsi commit, dan body PR. Identifier kode memakai bahasa Inggris (lihat `docs/glossary.md`).

---

## 2. Quick Start

Untuk task non-trivial:

```text
Task
→ Verifikasi branch / HEAD / sinkron dengan development
→ Identifikasi milestone (roadmap) + User Story + ADR terkait
→ Baca dokumen relevan di docs/
→ Baca current code + tests
→ Plan seperlunya
→ Implementasi di branch kerja
→ Verifikasi (lint, typecheck, test, build, pgTAP, browser)
→ Sinkronkan dokumen yang terdampak
→ Final diff review
→ Commit → push → PR ke development (body lengkap, §13)
```

Jangan mulai implementasi hanya berdasarkan:

- judul task;
- komentar PR lama;
- memory percakapan;
- satu file kode;
- test yang belum dijalankan;
- branch/HEAD lama.

---

## 3. Folder `docs/` adalah Pusat Referensi

| Dokumen | Digunakan untuk |
|---|---|
| `README.md` (root) | Gambaran produk, indeks, env var, keterlacakan keputusan D1–D20 |
| `docs/PRD.md` | Scope, tujuan, aturan bisnis, metrik, risiko |
| `docs/user-stories.md` | Kebutuhan per role + acceptance criteria (`US-P-*`, `US-G-*`, `US-A-*`) |
| `docs/workflow.md` | Alur produk, state machine sesi, penilaian |
| `docs/architecture.md` | Struktur modul, voice pipeline, LLM gateway, data model, RLS, API, kuota |
| `docs/decisions/*.md` | ADR: keputusan arsitektur permanen |
| `docs/ai-design.md` | Prompt persona/grader/generator, skema output, rumus nilai, eval |
| `docs/design-system.md` | Tokens, motion, komponen, responsif, aksesibilitas, copy |
| `docs/engineering-standard.md` | Tooling, konvensi kode, testing, Git & PR, performa, DoD |
| `docs/security-privacy.md` | Data pelajar, consent, retensi, ancaman & mitigasi |
| `docs/glossary.md` | Bahasa domain Indonesia ↔ identifier kode |
| `docs/roadmap.md` | Milestone M0–M5 dan spike |
| `docs/audit-legacy.md` | Audit prototipe lama |

---

## 4. Dokumen Minimum per Jenis Task

### Feature (full-stack)

```text
roadmap (milestone) → user-stories → PRD bagian terkait → workflow
→ architecture → ADR terkait → engineering-standard → code + tests
```

### UI / Frontend

```text
user-stories → design-system (WAJIB) → architecture §2
→ engineering-standard (performa, a11y, DoD) → komponen/halaman yang ada
```

### Database / Migration / RLS

```text
architecture §6–7 → security-privacy → ADR terkait
→ migrasi yang ada (supabase/migrations) → pgTAP (supabase/tests)
```

### LLM / Prompt / Suara / Avatar

```text
ai-design → architecture §3–5 → ADR-002, ADR-003, ADR-005
→ src/lib/llm → tes gateway + fixture eval
```

### Review PR

```text
refresh HEAD → identifikasi milestone/story → baca dokumen relevan
→ review delta → review source + tests → cek review threads
→ cek CI pada exact HEAD → klasifikasikan finding → verdict
```

---

## 5. Source of Truth

| Pertanyaan | Pemilik jawaban |
|---|---|
| Apa yang dibangun & aturan bisnis | PRD |
| Perilaku yang diharapkan pengguna | user-stories |
| Alur & state | workflow |
| Struktur, data, RLS, API | architecture |
| Keputusan permanen | ADR |
| Prompt, rubrik, rumus nilai | ai-design |
| Tampilan & interaksi | design-system |
| Cara menulis & menguji kode | engineering-standard |

Kode dan tes membuktikan **status implementasi**, bukan requirement baru. Kalau implementasi berbeda dari dokumen:

1. identifikasi perbedaannya;
2. cek dokumen pemiliknya;
3. jangan mengubah dokumen supaya cocok dengan kode tanpa keputusan pengguna;
4. laporkan dan minta keputusan.

Prototipe lama `../AI Interview` **bukan** referensi. Prototipe itu hanya diaudit (`docs/audit-legacy.md`); jangan menyalin kode, pola, atau gayanya.

---

## 6. Jangan Mengarang

Agent tidak boleh mengarang:

- role, permission, atau aturan akses baru;
- aturan percobaan, tenggat, kuota, atau rumus nilai;
- field atau tabel database di luar `architecture.md`;
- nama model LLM, endpoint, atau versi API. **Verifikasi ke dokumentasi resmi** dan ambil dari env;
- perilaku provider (Gemini Live, 9router) tanpa uji nyata;
- status milestone, CI, merge, atau deploy.

Kalau belum pasti, beri label:

- **Dikonfirmasi dokumen**
- **Terverifikasi implementasi/uji**
- **Inferensi engineering**
- **Perlu keputusan pengguna**

---

## 7. Stack & Aturan Kode

Detail lengkap ada di `docs/engineering-standard.md`. Ringkasnya:

- **Next.js 16** (App Router), TypeScript strict + `noUncheckedIndexedAccess`, Tailwind v4, npm (registry npmjs dikunci di `.npmrc`).
- **Supabase**: Postgres + RLS di semua tabel, Auth, Storage. Satu perubahan skema = satu file di `supabase/migrations/`, disertai tes pgTAP di `supabase/tests/`.
- **LLM** hanya lewat `src/lib/llm/gateway.ts`. Model diambil dari env (`CHAT_MODEL`, `GRADER_MODEL`, `LIVE_MODEL`, `GEMINI_FALLBACK_MODEL`), tidak di-hardcode.
- **Env** divalidasi di `src/lib/env.ts` (Zod, lazy). Modul yang menyentuh secret diberi `import "server-only"`.
- **Struktur** per fitur: `src/app` (routing), `src/features/<fitur>`, `src/lib` (infrastruktur).
- **Solusi terkecil yang lengkap.** Jangan menambah abstraksi, dependency, atau config "untuk nanti".

Versi Next.js ini punya breaking changes. Baca panduan di `node_modules/next/dist/docs/` sebelum memakai API Next.js yang belum pernah dipakai di repo ini (lihat blok di akhir file).

---

## 8. Aturan Domain yang Tidak Boleh Dilanggar

1. **Fakta tersembunyi & rubrik tidak pernah sampai ke browser pelajar.** Tidak lewat props, API, RLS, log client, maupun bundle.
2. **Audio tidak pernah disimpan** (ADR-004). Yang disimpan hanya transkrip, nilai, dan komentar.
3. **Secret tidak pernah ke client.** Live API memakai ephemeral token (ADR-002).
4. **Otorisasi selalu di server:** autentikasi → otorisasi (role + kepemilikan) → validasi Zod → aksi. RLS adalah lapisan kedua, bukan satu-satunya.
5. **Output LLM tidak dipercaya.** Selalu divalidasi; dirender sebagai teks, tidak pernah lewat `dangerouslySetInnerHTML`.
6. **Nilai dihitung di kode**, bukan oleh LLM (`docs/ai-design.md §3`).
7. **Data pelajar bisa dihapus permanen.** Setiap tabel baru yang berisi data pelajar harus ikut cascade.
8. **UI anti-AI-slop**: ikuti larangan di `docs/design-system.md §2`. Cek desktop + 360 px + keyboard + reduced-motion.

---

## 9. Task Lifecycle

```text
DISCOVER → ALIGN → PLAN → IMPLEMENT → VERIFY → DOCUMENT → REVIEW → COMPLETE
```

- **DISCOVER:** cek branch/HEAD, baca task, dependency, kode, dan tes yang ada.
- **ALIGN:** cocokkan task dengan dokumen. Kalau ada konflik material, berhenti dan tanya.
- **PLAN:** untuk task substansial, tentukan tujuan, scope, non-goal, AC, file terdampak, risiko (auth/data/privasi), tes, dan dokumen yang perlu disinkronkan. Jangan over-plan task kecil.
- **IMPLEMENT:** ikuti dokumen. Shortcut yang punya batas diberi komentar `shortcut: <batas>, <kapan upgrade>`.
- **VERIFY:** jalankan perintah di §12 sesuai risiko. Membaca kode tes bukan bukti tes lulus.
- **DOCUMENT:** sinkronkan dokumen yang terdampak (§10).
- **REVIEW:** baca seluruh diff; cek regresi, keamanan, perubahan yang tidak terkait, dan secret.
- **COMPLETE:** gunakan Definition of Done di §16.

---

## 10. Sinkronisasi Dokumen

| Dokumen | Update bila |
|---|---|
| `roadmap.md` | Item milestone selesai atau berubah urutan |
| `user-stories.md` | AC terbukti berbeda atau perlu klarifikasi (dengan persetujuan pengguna) |
| `architecture.md` | Modul, alur data, tabel, RLS, API, atau temuan provider berubah |
| ADR baru di `decisions/` | Keputusan yang sulit dibalik dan punya trade-off. **Tawarkan dulu, jangan buat otomatis** |
| `design-system.md` | Token atau komponen reusable baru/berubah |
| `engineering-standard.md` | Tooling atau aturan kerja berubah |
| `ai-design.md` | Prompt, skema output, atau rumus berubah (naikkan versi prompt) |
| README (root) | Env var, quickstart, atau status berubah |

Izin implementasi **tidak** mencakup mengubah requirement, menghapus AC, menurunkan DoD, atau menambah scope.

Bedakan selalu status berikut; satu tidak berarti yang lain:

```text
Implemented ≠ Verified ≠ Merged ≠ Deployed ≠ Dipakai di kelas (pilot)
```

---

## 11. Git, Branch & Workspace

Repo: `github.com/adrielwalintukan/interviewAI` (public).

```text
main          ← production. Hanya menerima merge dari development saat rilis (+ tag vX.Y.Z)
development   ← integrasi selama pengembangan
feat/… fix/… docs/… chore/… refactor/… test/…  ← branch kerja, dibuat dari development terbaru
```

- **Wajib branch baru** untuk setiap task. Dilarang commit langsung ke `development` atau `main`.
- Branch protection di `main` dan `development`:
  - Wajib lewat PR.
  - Wajib lulus check `App Quality Gate & Build` dan `Database pgTAP & RLS Tests`.
  - Branch harus up to date.
  - Force push dilarang.
- Merge branch kerja → `development` memakai **squash**. Merge `development` → `main` memakai **merge commit** + tag.
- **Jangan memakai git worktree** kecuali diminta.
- **Jangan merusak working tree:** jangan reset perubahan pengguna, jangan overwrite file yang tidak terkait, jangan hapus/pindah file tanpa izin. Kalau ada file asing (bukan buatan agent), baca dulu dan tanyakan.
- **Artefak QA** (screenshot, log, output smoke test) disimpan di luar repo (scratchpad).

### Izin di repo ini

| Aksi | Status |
|---|---|
| Buat branch kerja, commit, push branch kerja, buka PR ke `development` | Termasuk dalam permintaan implementasi task |
| Update body PR milik task sendiri, memperbaiki CI yang gagal di PR sendiri | Diizinkan |
| **Merge PR**, merge ke `main`, tag rilis | **Hanya oleh pengguna**, atau dengan instruksi eksplisit |
| Approve, request changes, resolve thread, komentar di PR orang lain | Hanya dengan instruksi eksplisit |
| Mengubah setting repo (branch protection, secrets, visibility) | Hanya dengan instruksi eksplisit |

### Database & layanan eksternal

- Project Supabase hosted: `wvupuzjytvbogxauoqxu`. **Jangan menjalankan SQL yang mengubah data/skema di project hosted** tanpa izin pengguna. Migrasi dijalankan oleh pengguna, atau lewat CLI dengan izin.
- Tes database berjalan di Supabase **lokal** (CI: `supabase start` + `supabase test db`). Fixture hanya user sintetis.
- Smoke test ke provider sungguhan (9router, Gemini, Supabase):
  - Pakai file sementara, lalu hapus setelah selesai.
  - **Jangan pernah mencetak nilai key**; laporkan nama variabel dan status saja.
  - Hemat kuota.

### Secret

Jangan commit atau publish:

- `.env.local` dan isinya;
- key Supabase, Gemini, 9router;
- token, password, data pelajar.

Sebelum commit, pindai diff staged untuk pola key (`AIza`, `sk-`, `sb_secret_`, `eyJhbGci`).

---

## 12. Verifikasi

Perintah wajib sebelum push (sama dengan CI):

```bash
npm run lint
```

```bash
npm run typecheck
```

```bash
npm test
```

```bash
npm run build
```

Tambahan sesuai risiko:

- **Migrasi/RLS:** tambah atau ubah tes pgTAP di `supabase/tests/`. Tes ini jalan di CI karena Docker tidak tersedia di mesin lokal pengguna. Tunggu job `Database pgTAP & RLS Tests` hijau sebelum menyatakan migrasi terverifikasi.
- **UI:** cek di browser pada desktop dan 360–375 px. Pastikan tidak ada overflow horizontal, tidak ada error console, keyboard dan reduced-motion berfungsi.
- **Prompt/grader:** `npm run eval` (setelah M4) dan catat hasilnya di PR.
- **Provider:** smoke test nyata bila perilaku provider menjadi asumsi (lihat temuan 9router di `architecture.md §4`).

Jangan menyatakan "CI hijau" kalau CI yang diperiksa bukan untuk HEAD saat ini.

---

## 13. Commit & Pull Request

### Commit

- **Conventional Commits.** Prefix dalam bahasa Inggris (`feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`), scope opsional, dan **deskripsi dalam Bahasa Indonesia**.

  ```text
  feat(kelas): tambahkan pembuatan kode gabung kelas
  fix(llm): kirim stream:false agar 9router membalas JSON
  test(db): tambah pgTAP RLS untuk class_members
  ```

- Satu commit = satu concern logis. Jangan mencampur refactor yang tidak terkait.
- Commit body dipakai untuk menjelaskan alasan atau constraint yang tidak terlihat dari diff.
- Stage file secara eksplisit kalau working tree berisi perubahan yang tidak terkait.

### Body PR wajib lengkap

Body PR mengikuti template `.github/pull_request_template.md`. **Jangan** menulis body singkat satu-dua baris. Setiap bagian diisi; bagian yang tidak relevan diisi "Tidak ada" beserta alasannya. Bagian wajib:

1. **Ringkasan**: apa yang berubah dan mengapa, 2–4 kalimat.
2. **Konteks**: milestone, User Story (`US-*`), ADR, dan dokumen acuan.
3. **Perubahan**: per area (UI, server/API, database, LLM, CI, dokumen), dengan path file kunci.
4. **Keputusan & trade-off**: pilihan yang diambil, alternatif, dan alasannya.
5. **Di luar scope / ditunda**: apa yang sengaja tidak dikerjakan dan kapan dikerjakan.
6. **Cara uji**: perintah yang dijalankan beserta hasilnya (jumlah tes, build). Sertakan langkah uji manual.
7. **Bukti**: status CI pada HEAD; screenshot/video desktop + mobile untuk perubahan UI; hasil smoke test (tanpa secret).
8. **Database & env**: migrasi baru (dan apakah sudah dijalankan di hosted), env var baru, langkah setup untuk pengguna.
9. **Risiko & rollback**: apa yang bisa rusak dan cara membatalkannya.
10. **Checklist DoD** (§16).

Saat HEAD berubah secara berarti (fix tambahan, scope bertambah), **perbarui body PR** supaya tetap akurat.

### Review PR

- Severity: **Blocker / Major / Minor / Tech Debt**.
- Komentar reviewer (manusia maupun AI) adalah hipotesis sampai diverifikasi terhadap HEAD, requirement, source, tes, dan bukti runtime. Jangan mengubah kode hanya untuk menutup komentar yang ternyata false positive.

---

## 14. Scope & Anti-Overengineering

Jangan:

- memperluas scope "sekalian";
- refactor lintas modul tanpa kebutuhan;
- menambah dependency untuk beberapa baris kode;
- membuat abstraksi generik untuk satu kasus;
- mengubah kontrak API secara oportunistis.

Kalau menemukan masalah yang tidak terkait: laporkan beserta dampaknya. Jangan memperbaikinya otomatis, kecuali diperlukan agar task aman atau pengguna mengizinkan.

---

## 15. Delegasi / Subagent

Root agent tetap bertanggung jawab atas hasil akhir. Subagent dipakai hanya bila bermanfaat nyata (review independen, eksplorasi luas). Output subagent adalah evidence tambahan, bukan source of truth.

---

## 16. Definition of Done Agent

```text
[ ] Branch kerja dibuat dari development terbaru; HEAD diverifikasi
[ ] Milestone / User Story / ADR terkait diidentifikasi
[ ] Dokumen relevan dibaca; aturan domain §8 dipatuhi
[ ] Otorisasi & validasi di server; RLS untuk tabel baru + tes pgTAP
[ ] lint, typecheck, test, build lulus secara lokal
[ ] UI dicek desktop + mobile + keyboard + reduced-motion (bila ada UI)
[ ] Tidak ada secret / .env.local / artefak QA di diff
[ ] Seluruh diff dibaca ulang; tidak ada perubahan yang tidak terkait
[ ] Dokumen terdampak disinkronkan (§10)
[ ] PR ke development dengan body lengkap (§13)
[ ] CI hijau pada HEAD PR
[ ] Blocker / langkah manual pengguna (migrasi, env, Vercel) dilaporkan
[ ] Implemented / Verified / Merged / Deployed tidak dicampur
```

Kalau ada item wajib yang belum terpenuhi, pakai status jujur: `in progress`, `partial`, `blocked`, `not ready for merge`.

---

## 17. Prinsip Akhir

```text
TASK → BACA DOKUMEN → IMPLEMENTASI → VERIFIKASI → SINKRON DOKUMEN → DIFF REVIEW → PR LENGKAP
```

`AGENTS.md` mengatur **cara kerja agent**. `docs/` mengatur **requirement, arsitektur, domain, standar, dan keputusan**. Ikuti source of truth, dan jangan mengklaim completion melebihi evidence.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
