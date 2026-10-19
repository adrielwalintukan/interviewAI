# Roadmap

Setiap milestone berakhir dengan sesuatu yang bisa di-demo dan di-deploy. Story yang dimaksud ada di [user-stories.md](user-stories.md).

| Milestone | Isi | Story | Demo di akhir |
|---|---|---|---|
| **M0 — Fondasi** | Setup Next.js 16 + Tailwind v4 + shadcn, tokens & font, Supabase project + migrasi awal + RLS, env (Zod), repo GitHub + branch `development` + branch protection, CI GitHub Actions di setiap PR, deploy Vercel (staging dari `development`, production dari `main`), `lib/llm/gateway` + tes fallback | — | Halaman editorial kosong ter-deploy; gateway lolos tes 429 → fallback |
| **M1 — Akun & Kelas** | Auth email/Google, role & persetujuan Pengajar, ganti password wajib, kelas + kode, akun massal CSV | US-P-01/02, US-G-01/02, US-A-01 | Pengajar membuat kelas & 30 akun; pelajar login & gabung |
| **M2 — Skenario** | Editor bertahap, generator AI, 6 karakter preset (potret CSS; VRM menyusul sebelum M3), terbit/versi, tugas, pustaka | US-G-03/05/06/10 | Skenario laundry dibuat < 10 menit dan diberikan sebagai tugas |
| **M3 — Ruang Wawancara** ◐ (kecuali VRM) | Panggung + transisi, avatar VRM (idle/kedip/lip-sync) — *menunggu aset, sementara potret + cincin level suara*, mode Fallback dulu (lebih mudah dites), lalu mode Live + ephemeral token + perpindahan otomatis, transkrip tersimpan per giliran, timer & percobaan | US-P-03..07, US-G-04 | Wawancara suara 10 menit di Chrome desktop & Android; fallback terpicu saat key Live dimatikan |
| **M4 — Penilaian & Laporan** ◐ (grader, laporan pelajar, review & override, dashboard kelas, ekspor CSV selesai; tersisa prompt eval) | Grader + skema + hitung nilai, laporan pelajar, review & override Pengajar, dashboard kelas, ekspor CSV, prompt eval | US-P-08..10, US-G-07..09 | Laporan dengan stabilo fakta; Pengajar override; CSV nilai |
| **M5 — Polish & Pilot** ◐ (pemantauan pemakaian dan hapus data pelajar Admin selesai) | Audit mobile & a11y, reduced motion, performa (budget), 5–8 karakter final, 3–5 skenario contoh, halaman Admin (kuota, hapus data), kebijakan privasi | US-A-02..04 | Pilot dengan 1 kelas nyata |

Spike yang sebaiknya dikerjakan **sebelum** M3, karena hasilnya menentukan arsitektur:

1. ✅ **Selesai 2026-10-14.** Ephemeral token mengunci `systemInstruction` (setup lengkap, tanpa `fieldMask`), endpoint `v1beta …Constrained`, model `gemini-3.8-live`. Relay AWS tidak dibutuhkan (ADR-002).
2. ◐ **Sebagian.** Sesi bersamaan sekitar 6 per project di free tier. Menit/hari belum diukur; pantau lewat `llm_calls` saat pilot.
3. Uji kualitas lip-sync berbasis analyser pada satu VRM, di desktop dan Android kelas menengah.
