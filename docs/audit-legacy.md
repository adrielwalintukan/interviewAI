# Audit Project Lama (`../AI Interview`)

Tanggal audit: 2026-10-13. Aplikasi tidak dijalankan; audit dilakukan dengan membaca kode.

## 1. Ringkasan

Project lama adalah prototipe latihan elisitasi kebutuhan: mahasiswa mewawancarai AI yang memerankan pemilik bisnis, sementara dosen mengelola skenario. Alur dasarnya (suara → OpenAI → suara) sudah berjalan. Avatar, memori percakapan, auth, database, dan penilaian belum ada atau rusak. **Rekomendasi: bangun ulang**, dengan membawa konsep-konsepnya, bukan kodenya.

## 2. Stack lama

- **Frontend:** HTML statis tanpa build, Tailwind CDN, `@google/model-viewer` (unpkg), Google Fonts.
- **Backend:** Express 4 (CommonJS), paket `openai` ^4 (`gpt-4o-mini`), dotenv, cors, body-parser (tidak dipakai).
- **Data:** `backend/data/scenarios.json`.
- **Lain-lain:** root `package.json` berisi `three` yang tidak pernah dipakai. Tidak ada git, `.gitignore`, maupun README.

## 3. Temuan

| Area | Kondisi | Catatan |
|---|---|---|
| Alur wawancara | ⚠️ Sebagian | STT `webkitSpeechRecognition` (id-ID, Chrome saja) → `/api/interview` → TTS `speechSynthesis` |
| Memori percakapan | ❌ | Setiap pertanyaan dikirim tanpa riwayat; AI lupa konteks |
| Pemilihan skenario | ❌ | `?skenario=id` diabaikan; selalu persona "Catherine's Catering" |
| Avatar | ❌ | `<model-viewer>` statis; kode Three.js `initAvatar` mati (canvas & library tidak ada) |
| Lip-sync (`tes/`) | ❌ | Babylon.js + morph `viseme_aa`, tapi dihubungkan ke `new Audio()` kosong; `speechSynthesis` tidak menghasilkan stream yang bisa dianalisis |
| Auth | ❌ | Hanya dropdown role; password diabaikan |
| CRUD skenario | ⚠️ | Berfungsi, tapi **tanpa auth** di API |
| Penilaian/laporan | ❌ | Tidak ada |
| Keamanan | ❌ | `escapeHtml` tidak meng-escape `<`; `title` dimasukkan ke `innerHTML` (XSS) |
| Bug data | ❌ | `scenarios.js` membaca `scenario.image`, padahal data memakai `avatarImg`; placeholder ke `via.placeholder.com` (layanan mati) |
| Startup | ⚠️ | `ai.js` dimuat via dynamic `import()`, jadi API sempat menjawab "AI belum siap" setelah boot |
| Secret | ✅ | `.env` berisi placeholder, tidak ada key asli ter-commit |
| Sampah | — | `.history/`, `.backups/`, `libs/` & `img/` kosong, background hot-link dari wallhaven.cc |

## 4. Dibawa vs dibuang

| Dibawa (sebagai konsep) | Dibuang |
|---|---|
| Pola prompt persona klien bisnis | Seluruh kode frontend HTML/JS |
| Konsep skenario + role pengajar/pelajar (dinamai ulang) | Express backend & JSON storage |
| Contoh domain: catering, wedding organizer, restoran (jadi bahan skenario contoh) | `model-viewer`, eksperimen Babylon |
| `avatar.glb` hanya untuk uji coba awal (bukan VRM, tidak dipakai di produksi) | Gaya glassmorphism gelap |

## 5. Pelajaran

1. Lip-sync butuh sumber audio yang bisa dianalisis. Karena itu Gemini Live (PCM) dipakai, dan fallback-nya memakai perkiraan dari teks (lihat [architecture.md §5](architecture.md#5-avatar--lip-sync)).
2. Riwayat percakapan wajib dikirim ke LLM, dan disimpan per giliran.
3. Otorisasi dan escaping harus menjadi default kerangka kerja, bukan tambahan manual (Next.js + RLS + React escaping).
