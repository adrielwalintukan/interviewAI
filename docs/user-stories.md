# User Stories

Format: `US-<role>-<no>`. Prioritas memakai MoSCoW (M = Must, S = Should, C = Could). AC = Acceptance Criteria (Given/When/Then).

## Pelajar

### US-P-01 Gabung kelas (M)
Sebagai Pelajar, saya ingin gabung kelas dengan kode supaya melihat tugas dari Pengajar.
- **Given** saya sudah login, **when** saya memasukkan kode kelas yang valid, **then** saya menjadi anggota dan diarahkan ke halaman kelas.
- **Given** kodenya salah atau kelas diarsipkan, **when** saya submit, **then** muncul pesan error tanpa membocorkan apakah kelas itu ada.
- **Given** saya sudah menjadi anggota, **when** saya memakai kode yang sama, **then** tidak ada keanggotaan ganda.

### US-P-02 Login dengan akun dari Pengajar (M)
Sebagai Pelajar tanpa email, saya ingin login dengan username dan password awal dari Pengajar.
- **Given** akun dibuat massal, **when** saya login pertama kali, **then** saya wajib mengganti password.
- **Given** saya salah password 5 kali, **then** login ditahan sementara (rate limit).

### US-P-03 Memulai wawancara tugas (M)
- **Given** tugas masih aktif dan percobaan masih tersisa, **when** saya menekan "Mulai", **then** muncul lobby: brief skenario (peran saya, tujuan, nama klien), cek mikrofon, dan consent mikrofon (sekali per akun).
- **When** saya masuk ke ruang wawancara, **then** jumlah percobaan berkurang satu, timer berjalan, dan karakter menyapa sesuai persona.
- **Given** percobaan habis atau tenggat lewat, **then** tombol "Mulai" nonaktif dan alasannya ditampilkan.

### US-P-04 Wawancara dengan suara (M)
- **When** saya berbicara, **then** karakter mendengar (indikator "mendengar"), lalu menjawab dengan suara dan lip-sync dalam waktu < 1.5 dtk (mode Live).
- **When** saya memotong karakter yang sedang bicara (barge-in), **then** karakter berhenti dan mendengarkan saya.
- **Then** transkrip live menampilkan ucapan saya dan karakter.

### US-P-05 Fallback otomatis (M)
- **Given** Gemini Live gagal terhubung atau kuota habis, **then** sesi pindah ke mode hemat tanpa kehilangan transkrip, dan muncul notifikasi halus "Mode hemat aktif".
- **Given** browser saya tidak mendukung STT, **then** input teks menjadi input utama.

### US-P-06 Mengetik pertanyaan (M)
- **When** saya mengetik dan menekan Enter, **then** pertanyaan masuk transkrip dan karakter menjawab dengan suara.

### US-P-07 Mengakhiri sesi (M)
- **When** saya menekan "Akhiri" (dengan konfirmasi) atau timer habis, **then** sesi ditutup, transkrip disimpan, dan penilaian dimulai.
- **Given** koneksi putus di tengah sesi, **then** transkrip sampai pesan terakhir tetap tersimpan dan sesi bisa diakhiri dari halaman tugas.

### US-P-08 Melihat laporan (M)
- **Then** laporan menampilkan:
  - Nilai total dan nilai per kriteria rubrik.
  - Fakta yang ditemukan, dengan kutipan pertanyaan yang membukanya.
  - Kategori fakta yang terlewat. Fakta terlewat tidak dibocorkan penuh selama tugas masih berjalan; detailnya dibuka setelah tenggat.
  - 3 contoh pertanyaan yang lebih baik.
- **Given** Pengajar sudah mereview, **then** nilai final dan komentar Pengajar tampil.

### US-P-09 Latihan di Pustaka Skenario (M)
- **Then** saya bisa memilih skenario publik dan berlatih tanpa tenggat, dalam batas kuota harian (default 3 sesi per hari).
- **Then** laporan latihan langsung membuka semua fakta yang terlewat.

### US-P-10 Riwayat (S)
- **Then** saya bisa melihat daftar sesi saya beserta nilai dan transkripnya.

## Pengajar

### US-G-01 Membuat kelas (M)
- **When** saya membuat kelas, **then** sistem membuat kode gabung 6–8 karakter yang bisa saya regenerasi.

### US-G-02 Membuat akun pelajar massal (M)
- **When** saya upload CSV (nama, username), **then** akun dibuat, langsung masuk ke kelas, dan saya bisa mengunduh daftar password awal **sekali saja**.
- **Given** ada username duplikat, **then** baris itu ditolak dengan alasan, dan baris lain tetap diproses.

### US-G-03 Membuat skenario dengan AI (M)
- **When** saya menulis ringkasan (mis. "pemilik laundry ingin aplikasi antar-jemput"), memilih bahasa dan tingkat, **then** AI menghasilkan draf:
  - Persona (nama, latar, gaya bicara).
  - Peran pelajar dan tujuan wawancara.
  - 8–15 fakta tersembunyi (kategori, bobot, kesulitan, pemicu).
  - Rubrik.
- **Then** semua field bisa diedit. Draf tersimpan otomatis.

### US-G-04 Preview skenario (M)
- **When** saya menekan "Uji coba", **then** saya bisa mewawancarai karakter sebagai pelajar. Hasilnya tidak masuk nilai dan tidak memakai kuota pelajar.

### US-G-05 Memilih karakter & suara (M)
- **Then** saya bisa memilih karakter VRM preset (dengan preview animasi) dan suara yang cocok.

### US-G-06 Memberi tugas (M)
- **When** saya membuat tugas dari skenario terbit, **then** saya mengatur tenggat, durasi (default 15), dan percobaan (default 3).
- **Given** skenario diedit setelah tugas dibuat, **then** tugas tetap memakai versi skenario saat tugas dibuat (snapshot).

### US-G-07 Mereview penilaian (M)
- **Then** saya melihat transkrip berdampingan dengan penilaian AI, beserta bukti per fakta.
- **When** saya meng-override nilai per kriteria dan menulis komentar, **then** nilai final berubah dan pelajar mendapat notifikasi.

### US-G-08 Dashboard kelas (S)
- **Then** saya melihat status tiap pelajar (belum mulai / selesai / nilai), sebaran nilai, dan fakta yang paling sering terlewat.

### US-G-09 Ekspor nilai (S)
- **Then** saya bisa mengunduh CSV nilai final per tugas.

### US-G-10 Publikasi ke Pustaka (S)
- **Then** saya bisa menandai skenario sebagai publik supaya muncul di Pustaka Skenario.

## Admin

### US-A-01 Mengelola role (M)
- **Then** Admin bisa mengubah role pengguna (Pelajar ↔ Pengajar) dan menonaktifkan akun.

### US-A-02 Menghapus data pelajar (M)
- **When** Admin menghapus pelajar, **then** profil, sesi, transkrip, dan penilaiannya terhapus permanen (cascade), dan tindakan itu tercatat di audit log.

### US-A-03 Mengelola karakter (S)
- **Then** Admin bisa menambah atau menonaktifkan karakter VRM preset beserta metadata suaranya.

### US-A-04 Memantau kuota (S)
- **Then** Admin melihat pemakaian harian (jumlah sesi, persentase fallback, error provider).
