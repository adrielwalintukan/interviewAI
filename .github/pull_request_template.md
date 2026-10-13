<!-- Isi semua bagian. Bagian yang tidak relevan: tulis "Tidak ada" + alasannya. Lihat AGENTS.md §13. -->

## Ringkasan

<!-- 2–4 kalimat: apa yang berubah dan mengapa. -->

## Konteks

- **Milestone:** <!-- M0–M5, docs/roadmap.md -->
- **User Story:** <!-- US-P-xx / US-G-xx / US-A-xx -->
- **ADR / dokumen acuan:** <!-- docs/... -->

## Perubahan

### UI

### Server / API

### Database

### LLM / Suara / Avatar

### CI / Tooling

### Dokumen

## Keputusan & trade-off

<!-- Pilihan yang diambil, alternatif yang ditolak, alasannya. -->

## Di luar scope / ditunda

<!-- Apa yang sengaja tidak dikerjakan + kapan/di mana akan dikerjakan. -->

## Cara uji

```bash
npm ci && npm run lint && npm run typecheck && npm test && npm run build
```

<!-- Hasil: jumlah tes lulus, status build. Lalu langkah uji manual. -->

## Bukti

- **CI pada HEAD:**
- **Screenshot / video (desktop + mobile):**
- **Smoke test provider (tanpa secret):**

## Database & environment

- **Migrasi baru:** <!-- path + sudah/belum dijalankan di Supabase hosted -->
- **Env var baru:**
- **Langkah setup untuk pemilik repo:**

## Risiko & rollback

## Checklist

- [ ] Branch dari `development` terbaru
- [ ] Otorisasi & validasi Zod di server; RLS + pgTAP untuk tabel baru
- [ ] `lint`, `typecheck`, `test`, `build` lulus lokal
- [ ] UI dicek desktop + 360 px + keyboard + reduced-motion
- [ ] Tidak ada secret / `.env.local` / artefak QA di diff
- [ ] Dokumen terdampak disinkronkan
- [ ] CI hijau pada HEAD
