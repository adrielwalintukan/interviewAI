# Workflow

Alur produk utama. Untuk alur kerja developer, lihat [engineering-standard.md](engineering-standard.md).

## 1. Onboarding & gabung kelas

```mermaid
flowchart TD
  A[Landing] --> B{Punya akun?}
  B -- Tidak --> C[Daftar email/Google]
  B -- Ya --> D[Login]
  C --> E[Pilih: Saya Pelajar / Saya Pengajar*]
  D --> F{Akun massal & login pertama?}
  F -- Ya --> G[Wajib ganti password]
  F -- Tidak --> H[Dashboard]
  G --> H
  E --> H
  H --> I[Masukkan kode kelas]
  I --> J[Halaman kelas: daftar tugas]
```

\* Daftar sebagai Pengajar statusnya `pending` sampai disetujui Admin. Ini mencegah orang mengaku-ngaku sebagai Pengajar.

## 2. Pembuatan skenario → tugas

```mermaid
flowchart LR
  A[Ringkasan + bahasa + tingkat] --> B[AI generate draf]
  B --> C[Edit persona, fakta, rubrik]
  C --> D[Pilih karakter & suara]
  D --> E[Uji coba / preview]
  E -->|perlu perbaikan| C
  E --> F[Terbitkan: versi n]
  F --> G[Buat tugas di kelas]
  F --> H[Opsional: publik ke Pustaka]
  G --> I[Snapshot versi skenario disimpan di tugas]
```

## 3. State machine sesi wawancara

```mermaid
stateDiagram-v2
  [*] --> Lobby
  Lobby --> Connecting: Mulai (attempt -1)
  Connecting --> Live: Gemini Live tersambung
  Connecting --> Fallback: gagal / 429 / timeout 5 dtk
  state Live {
    [*] --> Listening
    Listening --> Thinking: pelajar selesai bicara
    Thinking --> Speaking: audio pertama diterima
    Speaking --> Listening: giliran selesai
    Speaking --> Listening: barge-in
  }
  Live --> Fallback: koneksi putus / kuota habis di tengah sesi
  state Fallback {
    [*] --> F_Listening
    F_Listening --> F_Thinking: STT final / teks dikirim
    F_Thinking --> F_Speaking: jawaban LLM (stream)
    F_Speaking --> F_Listening: TTS selesai
  }
  Live --> Ending: Akhiri / timer habis
  Fallback --> Ending: Akhiri / timer habis
  Ending --> Grading: transkrip tersimpan
  Grading --> Report
  Report --> [*]
```

Aturan:

- **Satu arah.** Perpindahan ke Fallback hanya terjadi satu kali per sesi. Sesi tidak bolak-balik supaya karakter tetap konsisten.
- **Konteks dibawa.** Saat pindah, seluruh transkrip ikut dikirim sebagai riwayat ke LLM teks, jadi percakapan tetap nyambung.
- **Penyimpanan bertahap.** Setiap giliran (user dan karakter) langsung disimpan ke tabel `messages`. Ini mencegah transkrip hilang kalau sesi terputus.

## 4. Penilaian → review → laporan

```mermaid
sequenceDiagram
  participant P as Pelajar
  participant S as Server (Server Action)
  participant L as LLM Gateway
  participant DB as Supabase
  participant G as Pengajar
  P->>S: endSession(sessionId)
  S->>DB: status = grading
  S->>L: grade(transkrip, fakta, rubrik) [GRADER_MODEL]
  L-->>S: JSON evaluasi (divalidasi Zod)
  S->>DB: insert evaluations, status = graded
  S-->>P: laporan (fakta terlewat disamarkan jika tugas masih aktif)
  G->>S: review & override
  S->>DB: update evaluations.final_score, comment
  DB-->>P: notifikasi nilai final
```

Kalau grading gagal (error provider atau JSON tidak valid), sistem mencoba ulang 2× dengan backoff; di setiap percobaan gateway sudah memakai provider fallback bila provider utama gagal. Sesi yang ditutup timer tanpa "Akhiri" dinilai saat pemiliknya membuka halaman ringkasan. Sesi tanpa satu pun pertanyaan pelajar tidak dinilai. Sesi Pustaka dan preview tidak punya pengajar, jadi pemilik sesinya sendiri yang bisa menekan "Nilai ulang" saat `grading_failed`. Override pengajar tetap dipertahankan bila sesi dinilai ulang. Kalau tetap gagal, status menjadi `grading_failed`, Pengajar bisa memicu penilaian ulang, dan pelajar melihat "Penilaian sedang diproses".

## 5. Mode Pustaka (latihan bebas)

Alurnya sama dengan sesi tugas, dengan tiga perbedaan:

- Tidak ada tenggat atau batas percobaan; yang ada kuota harian (default 3 sesi per pelajar per hari).
- Laporan langsung membuka semua fakta yang terlewat.
- Nilai tidak masuk ke dashboard kelas.
