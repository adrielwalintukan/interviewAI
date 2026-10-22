# Interview AI

> Nama produk masih sementara.

Interview AI adalah platform latihan **wawancara elisitasi kebutuhan** untuk sekolah dan kampus. Pelajar mewawancarai karakter AI 3D yang memerankan klien, pemilik bisnis, atau mitra. Karakter ini berbicara dan bereaksi secara realtime. Di setiap skenario tersimpan **fakta tersembunyi**: makin dalam dan tepat pertanyaan pelajar, makin banyak fakta yang terbuka. Setelah sesi selesai, AI menilai transkrip memakai rubrik, lalu Pengajar mereview hasilnya.

Status: **M3 — Ruang Wawancara** (avatar VRM: kode dan 6 aset siap, menunggu unggah ke Storage dan uji perangkat) (lihat [roadmap](docs/roadmap.md)). Prototipe lama ada di `../AI Interview` (lihat [audit-legacy.md](docs/audit-legacy.md)).

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
| [vrm-spec.md](docs/vrm-spec.md) | Spesifikasi 6 karakter VRoid (gaya, ekspresi lip-sync, ukuran, lisensi) |
| [audit-legacy.md](docs/audit-legacy.md) | Audit project lama |
| [decisions/](docs/decisions/) | ADR 001–005 |

## Tech stack (ringkas)

- **Frontend:** Next.js 16 (App Router, TypeScript), Tailwind CSS v4, shadcn/ui (dikustom), Motion.
- **Avatar 3D:** React Three Fiber + `@pixiv/three-vrm` 3.x.
- **Backend & data:** Supabase (Postgres, Auth, RLS, Storage).
- **Suara:** Gemini Live API, dengan fallback mode hemat (Web Speech API untuk mendengar, Gemini TTS untuk suara karakter).
- **LLM teks:** 9router (OpenAI-compatible), dengan fallback Gemini API.
- **Hosting:** Vercel.

Detail dan alasannya ada di [architecture.md](docs/architecture.md) dan [decisions/](docs/decisions/).

## Quickstart

Butuh Node.js 22. Isi `.env.local` dari `.env.example`.

```bash
npm install
```

```bash
cp .env.example .env.local
```

```bash
npm run dev
```

Eval prompt grader (memanggil provider sungguhan dan memakai kuota; jalankan saat prompt/model grader berubah):

```bash
npm run eval
```

## Setup Supabase (sekali)

1. Jalankan file di `supabase/migrations/` **berurutan** di SQL Editor Supabase. Tunggu job CI `Database pgTAP & RLS Tests` hijau dulu. Migrasi `20261026000000_retention_job.sql` mengaktifkan extension `pg_cron` dan menjadwalkan job retensi bulanan `monthly-retention`. Cek di **Integrations → Cron** atau lewat `select * from cron.job;`.
2. **Email (#18).** Email bawaan Supabase hanya terkirim ke anggota tim project, jadi pakai SMTP sendiri (Gmail):
   - Akun Google pengirim: aktifkan verifikasi 2 langkah, lalu buat **App Password** (Akun Google → Keamanan → Sandi aplikasi). Batas Gmail sekitar 500 email/hari.
   - **Authentication → Emails → SMTP Settings**: aktifkan custom SMTP. Host `smtp.gmail.com`, port `465`, username = alamat Gmail, password = App Password, sender email = alamat Gmail yang sama, sender name `Interview AI`.
   - **Authentication → Emails → Templates → Confirm signup**: subjek `Konfirmasi akun Interview AI`, isi:

     ```html
     <h2>Konfirmasi email Anda</h2>
     <p>Klik tautan berikut untuk mengaktifkan akun Interview AI Anda.</p>
     <p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}">Konfirmasi email</a></p>
     <p>Abaikan email ini bila Anda tidak merasa mendaftar.</p>
     ```

     Tautan memakai `{{ .RedirectTo }}` (bukan `{{ .ConfirmationURL }}`) agar diproses `auth/callback` dan bisa dibuka di perangkat lain. Template lain tidak dipakai aplikasi.
   - **Authentication → Sign In / Providers → Email**: nyalakan **Confirm email**.
3. **Authentication → URL Configuration**: Site URL = URL production. Redirect URLs: `http://localhost:3000/**`, `https://<url-production>/**`, dan `https://<url-staging>/**` (lihat Deploy).
4. **Google OAuth (#18).**
   - Google Cloud Console → **APIs & Services → OAuth consent screen**: tipe External, isi nama aplikasi dan email, scope bawaan saja (email, profile, openid). Ubah status ke **In production**; selama masih *Testing*, hanya akun test user yang bisa masuk.
   - **Credentials → Create credentials → OAuth client ID**, tipe *Web application*. Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
   - Supabase **Authentication → Sign In / Providers → Google**: aktifkan, isi Client ID dan Client Secret.
   - Set `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true` di Vercel (dan `.env.local` bila ingin menguji lokal).
5. **Admin pertama**: daftar lewat `/daftar`, lalu jalankan di SQL Editor (ganti emailnya):

```sql
update public.profiles set role = 'admin', status = 'active'
where id = (select id from auth.users where email = 'email-anda@contoh.com');
```

## Deploy (Vercel)

Staging dan production memakai satu project Supabase (`docs/engineering-standard.md §6`).

1. Vercel → **Add New → Project** → import repo ini (framework Next.js terdeteksi otomatis).
2. **Settings → Environment Variables**: isi semua variabel di tabel bawah untuk **Production** dan **Preview**. Variabel tanpa awalan `NEXT_PUBLIC_` hanya dibaca server. `LIVE_MAX_CONCURRENT` opsional (bawaan 5).
3. **Settings → Git**: Production Branch = `main`. Setiap push ke `development` membuat deploy preview dengan URL cabang tetap `https://<project>-git-development-<akun>.vercel.app`; URL ini yang dipakai sebagai **staging**.
4. **Settings → Functions → Function Region**: pilih region yang sama atau terdekat dengan region project Supabase (Supabase → Project Settings → General).
5. Daftarkan URL production dan staging di Supabase Redirect URLs (Setup Supabase langkah 3).

**Rotasi key** (bila ada indikasi bocor, `docs/security-privacy.md`): buat key baru di penyedianya (Supabase, Google AI Studio, 9router, Google Cloud), ganti nilainya di Vercel untuk Production dan Preview, redeploy, lalu cabut key lama.

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
| `TTS_MODEL` | server | Model Gemini TTS untuk suara karakter di mode hemat (nama suara sama dengan Live) |
| `GEMINI_FALLBACK_MODEL` | server | Model teks Gemini yang dipakai bila 9router gagal |
| `LIVE_MAX_CONCURRENT` | server | Opsional. Batas sesi Live bersamaan sebelum sesi baru masuk mode hemat (bawaan 5) |
| `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED` | client | `true` untuk menampilkan tombol login Google (setelah OAuth Client diisi di Supabase) |

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
