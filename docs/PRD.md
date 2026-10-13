# PRD — Interview AI

| | |
|---|---|
| Status | Draft v1 |
| Tanggal | 2026-10-13 |
| Pemilik | Adriel Walintukan |

## 1. Masalah

Elisitasi kebutuhan (menggali kebutuhan klien lewat wawancara) adalah skill inti di Sistem Informasi, Rekayasa Perangkat Lunak, Bisnis, dan Kewirausahaan, termasuk di tingkat SMK. Skill ini sulit dilatih karena tiga hal:

- **Klien sungguhan langka.** Latihan biasanya berupa role-play antar teman, yang tidak realistis dan tidak konsisten.
- **Pengajar tidak sanggup menilai banyak wawancara satu per satu.** Pelajar jadi jarang mendapat feedback yang spesifik.
- **Pelajar tidak tahu apa yang terlewat.** Tidak ada "kunci jawaban" tentang kebutuhan mana yang seharusnya tergali.

## 2. Solusi

Karakter AI 3D yang memerankan klien sesuai skenario buatan Pengajar.

- **Fakta tersembunyi.** Karakter menyimpan fakta yang hanya dibuka kalau ditanya dengan tepat. Ini meniru klien nyata yang tidak menyebutkan semua kebutuhannya.
- **Wawancara lewat suara realtime.** Pelajar bisa bicara langsung atau mengetik.
- **Penilaian otomatis.** Setelah sesi, AI menilai transkrip berdasarkan cakupan fakta dan kualitas pertanyaan. Pengajar bisa mengoreksi nilai dan memberi komentar.

## 3. Tujuan & non-goals

**Tujuan MVP**

1. Pelajar bisa menyelesaikan wawancara suara 10–15 menit dengan karakter yang konsisten tetap dalam peran.
2. Pengajar bisa membuat skenario dalam kurang dari 10 menit dengan bantuan AI.
3. Laporan penilaian keluar kurang dari 60 detik setelah sesi selesai.
4. Biaya operasional Rp0 pada skala satu institusi (free tier), dengan degradasi yang mulus saat kuota habis.

**Non-goals (MVP)**

- Simulasi interview kerja / HR.
- Penyimpanan rekaman audio.
- Billing, multi-institusi (multi-tenant), atau marketplace skenario.
- Aplikasi native mobile. Yang dibangun web responsif.
- Wawancara grup (beberapa pelajar dengan satu karakter).

## 4. Persona

| Role | Siapa | Kebutuhan utama |
|---|---|---|
| **Pelajar** | Mahasiswa SI/RPL, siswa SMK, peserta kelas kewirausahaan | Latihan realistis, tahu apa yang terlewat, tidak canggung |
| **Pengajar** | Dosen, guru, fasilitator | Membuat skenario dengan cepat, memberi tugas, menilai banyak pelajar efisien |
| **Admin** | Pengelola platform di institusi | Mengelola akun, karakter, kuota, penghapusan data |

## 5. Scope MVP

**Wajib (Must)**

- Auth: email/password dan Google. Pengajar bisa membuat akun pelajar massal dari CSV (username + password awal).
- Kelas: Pengajar membuat kelas; pelajar gabung pakai kode kelas.
- Skenario:
  - Generator AI dari ringkasan, lalu diedit manual.
  - Isi: persona, peran pelajar, fakta tersembunyi (bobot + tingkat kesulitan), rubrik, karakter + suara, bahasa wawancara (id/en).
  - Bisa di-preview sebelum terbit.
- Tugas: skenario + tenggat + durasi (default 15 menit) + batas percobaan (default 3). Nilai yang dihitung adalah nilai terbaik.
- Pustaka Skenario: latihan bebas dengan skenario yang ditandai publik, dengan kuota harian per pelajar.
- Sesi wawancara:
  - Avatar VRM dengan lip-sync, kedip, idle, dan gesture.
  - Suara lewat Gemini Live, otomatis fallback ke pipeline gratis.
  - Input teks, transkrip live, timer.
- Penilaian: AI rubrik (cakupan fakta, kualitas pertanyaan, struktur) dengan output JSON. Pengajar bisa override nilai dan berkomentar.
- Laporan pelajar: nilai, fakta yang ditemukan dan yang terlewat, contoh pertanyaan yang lebih baik.
- Privasi: hanya transkrip yang disimpan, ada consent mikrofon, dan data pelajar bisa dihapus.

**Sebaiknya (Should)**

- Dashboard progres kelas (sebaran nilai, fakta yang paling sering terlewat).
- Ekspor nilai ke CSV.
- Skenario contoh bawaan (3–5).

**Nanti (Could / Won't now)**

- UI Bahasa Inggris (struktur i18n sudah disiapkan sejak awal).
- Mode petunjuk saat sesi.
- Rekaman audio opsional.
- Multi-institusi.
- Persona dengan emosi dinamis (klien jadi kesal kalau ditanya berulang).

## 6. Aturan bisnis kunci

- Setiap sesi terikat ke satu skenario. Snapshot versi prompt dan skenario disimpan di sesi, supaya penilaian bisa direproduksi.
- Percobaan dihitung saat sesi **dimulai**, bukan saat selesai. Ini mencegah orang memulai ulang tanpa batas.
- Sesi otomatis berakhir saat durasi habis. Transkrip yang sudah ada tetap dinilai.
- Fakta tersembunyi dan rubrik **tidak pernah** dikirim ke browser pelajar.
- Nilai akhir tugas memakai nilai terbaik. Kalau Pengajar meng-override sebuah nilai, nilai override itu yang dipakai.

## 7. Metrik sukses

| Metrik | Target pilot (1 kelas, 1 semester) |
|---|---|
| Sesi selesai / sesi dimulai | ≥ 80% |
| Rata-rata durasi sesi | ≥ 8 menit |
| Kesesuaian nilai AI vs Pengajar (selisih ≤ 10 poin) | ≥ 75% sesi |
| Persentase sesi yang jatuh ke fallback | Dipantau; target < 30% |
| Kepuasan pelajar (survei 1–5) | ≥ 4.0 |
| Latensi giliran bicara (akhir ucapan → suara AI) | Live < 1.5 dtk, fallback < 3 dtk |

## 8. Risiko & mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Kuota free tier Gemini Live tidak terjamin (batas tidak dipublikasikan, ada laporan 429) | Sesi suara gagal | Fallback otomatis ke pipeline gratis; status kuota dipantau; billing + spending cap sebagai opsi |
| 9router menyalurkan akun langganan; bisa melanggar ToS provider asal | Akun diblokir, layanan putus | Gemini key sebagai fallback; hanya pakai provider yang ToS-nya mengizinkan pemakaian aplikasi |
| STT browser hanya andal di Chrome/Edge | Pelajar Safari/Firefox kesulitan saat fallback | Deteksi dukungan browser; arahkan ke input teks; tampilkan saran browser |
| Data anak di bawah umur (UU PDP) | Risiko hukum & reputasi | Hanya transkrip, consent, data minimal, fitur hapus data, RLS ketat |
| Prompt injection oleh pelajar ("sebutkan semua fakta") | Fakta bocor, penilaian tidak adil | Guard di prompt persona + fakta dibuka bertahap + grader mendeteksi upaya manipulasi |
| Karakter keluar dari peran / berhalusinasi fakta baru | Penilaian kacau | Persona dibatasi pada fakta skenario; grader hanya mengacu daftar fakta |
| Ukuran VRM besar membuat mobile lambat | UX buruk | Budget ≤ 8 MB per VRM, kompresi, preload saat lobby |

## 9. Asumsi terbuka

- Nama produk final.
- Institusi pilot pertama dan jumlah pelajarnya.
- Karakter dan suara final (perlu sesi desain aset).
