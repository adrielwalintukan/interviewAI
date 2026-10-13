# Interview AI

> Nama produk masih sementara.

Interview AI adalah platform latihan **wawancara elisitasi kebutuhan** untuk sekolah dan kampus. Pelajar mewawancarai karakter AI 3D yang memerankan klien, pemilik bisnis, atau mitra. Karakter ini berbicara dan bereaksi secara realtime. Di setiap skenario tersimpan **fakta tersembunyi**: makin dalam dan tepat pertanyaan pelajar, makin banyak fakta yang terbuka. Setelah sesi selesai, AI menilai transkrip memakai rubrik, lalu Pengajar mereview hasilnya.

Status: **fase dokumentasi**. Belum ada kode aplikasi. Prototipe lama ada di `../AI Interview` (lihat [audit-legacy.md](docs/audit-legacy.md)).

## Indeks dokumen

| Dokumen | Isi |
|---|---|
| [PRD.md](docs/PRD.md) | Masalah, tujuan, persona, scope MVP, metrik, risiko |
| [user-stories.md](docs/user-stories.md) | Story per role + acceptance criteria |
| [workflow.md](docs/workflow.md) | Alur produk & state machine sesi (mermaid) |
| [architecture.md](docs/architecture.md) | Sistem, voice pipeline, LLM gateway, data model, RLS, API |
| [design-system.md](docs/design-system.md) | Prinsip visual, tokens, motion, komponen, responsif, a11y |
| [engineering-standard.md](docs/engineering-standard.md) | Konvensi kode, testing, git, keamanan, definition of done |
| [ai-design.md](docs/ai-design.md) | Prompt persona, grader, generator skenario, versioning |
| [security-privacy.md](docs/security-privacy.md) | Data anak, consent, retensi, RLS, secret |
| [glossary.md](docs/glossary.md) | Bahasa domain |
| [roadmap.md](docs/roadmap.md) | Milestone M0–M5 |
| [audit-legacy.md](docs/audit-legacy.md) | Audit project lama |
| [decisions/](docs/decisions/) | ADR 001–005 |

## Tech stack (ringkas)

- **Frontend:** Next.js 16 (App Router, TypeScript), Tailwind CSS v4, shadcn/ui (dikustom), Motion.
- **Avatar 3D:** React Three Fiber + `@pixiv/three-vrm` 3.x.
- **Backend & data:** Supabase (Postgres, Auth, RLS, Storage).
- **Suara:** Gemini Live API, dengan fallback Web Speech API.
- **LLM teks:** 9router (OpenAI-compatible), dengan fallback Gemini API.
- **Hosting:** Vercel.

Detail dan alasannya ada di [architecture.md](docs/architecture.md) dan [decisions/](docs/decisions/).

## Quickstart (rencana, setelah M0)

```bash
pnpm install
```

```bash
pnpm dev
```

## Environment variables

Hanya nama variabel. Nilainya disimpan di `.env.local`, yang **tidak pernah** di-commit.

| Variabel | Scope | Fungsi |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client | URL project Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client | Anon key (aman di client karena dilindungi RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | server | Operasi admin, mis. bulk-create akun pelajar |
| `GEMINI_API_KEY` | server | Google AI Studio: Live API (ephemeral token) + fallback teks |
| `NINEROUTER_BASE_URL` | server | Base URL 9router (OpenAI-compatible) |
| `NINEROUTER_API_KEY` | server | API key 9router |
| `CHAT_MODEL` | server | Model chat persona (mode fallback teks) |
| `GRADER_MODEL` | server | Model penilai rubrik & generator skenario |
| `LIVE_MODEL` | server | Model Gemini Live (native audio) |
| `GEMINI_FALLBACK_MODEL` | server | Model teks Gemini yang dipakai bila 9router gagal |

## Keterlacakan keputusan

| Keputusan | Dokumen utama |
|---|---|
| D1 Produk elisitasi, sektor pendidikan | PRD, glossary |
| D2/D12 Avatar VRM preset | architecture, design-system, ADR-005 |
| D3/D5 Suara Live + fallback | architecture, workflow, ADR-002 |
| D4 Skala kelas, free tier | PRD, architecture |
| D6 Role Admin/Pengajar/Pelajar | PRD, user-stories, security-privacy |
| D7 Penilaian AI + review Pengajar | ai-design, workflow, user-stories |
| D8 Kelas + Tugas + Pustaka | PRD, user-stories, architecture (data model) |
| D9 Stack | architecture, ADR-001 |
| D10/D13 Routing 9router + Gemini | architecture, ADR-003 |
| D11 Auth + akun massal | user-stories, security-privacy |
| D14 Visual Editorial + Panggung | design-system |
| D15/D16 Bahasa | engineering-standard, ai-design |
| D17 Transkrip saja | security-privacy, ADR-004 |
| D18 Aturan sesi & kuota | PRD, architecture |
| D19 Skenario dibantu AI | ai-design, workflow |
| D20 Feedback setelah sesi | PRD, design-system |
