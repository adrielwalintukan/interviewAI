# Security & Privacy

Pengguna platform ini termasuk siswa di bawah umur. Rujukan prinsip: UU No. 27/2022 tentang Pelindungan Data Pribadi (UU PDP). Dokumen ini bukan nasihat hukum; sebelum pilot, minta institusi meninjau.

## 1. Data yang disimpan

| Data | Disimpan? | Alasan |
|---|---|---|
| Nama tampilan, username/email | Ya | Identitas akun |
| Transkrip wawancara (teks) | Ya | Penilaian & review |
| Nilai, rubrik, komentar | Ya | Fungsi inti |
| **Audio mikrofon** | **Tidak pernah** | Audio dikirim langsung ke Gemini Live atau diproses STT browser; server tidak menerima maupun menyimpannya |
| Foto, tanggal lahir, nomor HP, alamat | Tidak dikumpulkan | Minimisasi data |
| Metadata LLM (`llm_calls`) | Ya, tanpa isi prompt | Pemantauan biaya & error |

Catatan pihak ketiga: audio dan teks diproses oleh Google (Gemini) dan provider di balik 9router sesuai ketentuan masing-masing. Hal ini disebut jelas di layar consent dan kebijakan privasi.

## 2. Consent

- **Consent mikrofon.** Ditampilkan sekali per akun sebelum sesi pertama. Isinya menjelaskan: audio diproses pihak ketiga, tidak disimpan, dan transkrip disimpan untuk penilaian. Waktunya disimpan di `profiles.mic_consent_at`.
- **Bisa ditolak.** Pelajar yang menolak tetap bisa memakai mode teks.
- **Akun massal untuk siswa di bawah umur.** Tanggung jawab persetujuan orang tua ada pada institusi. Pengajar mencentang konfirmasi saat upload CSV.

## 3. Retensi & penghapusan

- **Transkrip & evaluasi** disimpan selama akun aktif, atau sampai kelas diarsipkan + 1 tahun (job pembersihan bulanan).
- **Penghapusan atas permintaan.** Admin bisa menghapus pelajar. Penghapusan bersifat cascade (sesi, pesan, evaluasi, keanggotaan) dan tercatat di `audit_log` tanpa menyimpan data yang dihapus.
- **Unduh data.** Pelajar bisa mengunduh transkripnya sendiri (Should).

## 4. Kontrol akses

- **RLS aktif di semua tabel.** Rangkumannya ada di [architecture.md §7](architecture.md#7-rls-ringkas).
- **Rahasia skenario.** Draf (`scenarios.draft`) dan `scenario_version_secrets` (persona, fakta, rubrik) **tidak bisa dibaca** oleh pelajar maupun pengajar lain lewat API apa pun (diuji pgTAP `m2_scenarios`). Fakta yang terlewat di laporan hanya ditampilkan setelah tenggat lewat, lewat view server-side.
- **Persetujuan Pengajar.** Role `pengajar` hasil pendaftaran mandiri statusnya `pending` sampai disetujui Admin.
- **Batas akun massal.** Akun massal dibatasi untuk kelas milik Pengajar itu. Password awal dibuat acak (12 karakter), hanya ditampilkan atau diunduh sekali, dan pelajar wajib menggantinya saat login pertama.

## 4a. Password & email

- **Password tidak pernah disimpan atau ditampilkan oleh aplikasi.** Supabase Auth hanya menyimpan hash bcrypt (`auth.users.encrypted_password`), yang tidak bisa dibalik, termasuk oleh pemilik project. Kolom password di `profiles` **dilarang** (keputusan 2026-10-14).
- **Lupa password:** admin (semua akun kecuali dirinya) atau pengajar (hanya pelajar di kelasnya, dicek `teaches_user()`) me-**reset**. Password awal baru ditampilkan sekali, lalu pelajar wajib menggantinya saat masuk. Password lama tidak pernah bisa dilihat.
- **Email** tetap hanya di `auth.users`. Halaman Admin membacanya di server lewat Admin API (khusus admin). Pengajar dan pelajar lain tidak bisa melihat email siapa pun. Akun username memakai email sintetis `.invalid`, sehingga yang ditampilkan adalah username-nya.

## 5. Secret & kunci

- **Hanya di env server:** `GEMINI_API_KEY`, `NINEROUTER_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Modul yang memakainya diberi `import "server-only"`.
- **Ephemeral token Live:**
  - `uses: 1`.
  - Masa berlaku untuk memulai sesi baru 1 menit.
  - `expireTime` = durasi tugas + 2 menit.
  - Hanya diterbitkan untuk sesi `active` milik pemanggil.
- **Rotasi kunci** dilakukan bila ada indikasi bocor. Ada checklist rotasinya di README deploy (M0).

## 6. Ancaman & mitigasi

| Ancaman | Mitigasi |
|---|---|
| Prompt injection untuk membocorkan fakta | Guard di prompt persona, fakta dibuka bertahap, anomali ditandai grader, review Pengajar |
| Transkrip dipalsukan di mode Live (dikirim dari client) | Validasi urutan & rate, deteksi anomali oleh grader, review Pengajar; upgrade ke relay server untuk ujian (lihat ADR-002) |
| XSS (pernah terjadi di project lama) | React escaping bawaan; dilarang `dangerouslySetInnerHTML` pada konten pengguna/LLM; CSP ketat |
| Penyalahgunaan kuota (spam sesi) | 1 sesi aktif per pelajar, kuota harian, rate limit pesan, batas sesi Live bersamaan |
| Brute force login | Rate limit Supabase Auth + lockout sementara |
| Upload CSV berbahaya | Parse di server, batas 500 baris, validasi Zod per baris, tolak formula (`=`, `+`, `-`, `@` di awal sel saat ekspor CSV) |
| 9router menyalurkan akun langganan | Risiko ToS diterima secara sadar oleh pemilik; selalu ada fallback Gemini key |

## 7. Header & konfigurasi

- **CSP:**
  - `default-src 'self'`.
  - `connect-src` dibatasi ke Supabase, `generativelanguage.googleapis.com` (WS), dan origin 9router (hanya dari server, jadi tidak perlu di CSP client).
- **Header lain:** `Permissions-Policy: microphone=(self)`, `Referrer-Policy: strict-origin-when-cross-origin`, HSTS (Vercel).
