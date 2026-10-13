# Glosarium

Bahasa domain dipakai konsisten di UI, dokumen, dan kode. Kolom "Kode" adalah identifier bahasa Inggris yang dipakai di source code.

| Istilah | Kode | Definisi |
|---|---|---|
| Pelajar | `learner` (role `pelajar`) | Siswa atau mahasiswa yang melakukan wawancara |
| Pengajar | `teacher` (role `pengajar`) | Guru, dosen, atau fasilitator; membuat skenario, kelas, dan tugas, serta mereview nilai |
| Admin | `admin` | Pengelola platform di institusi |
| Kelas | `class` | Kelompok pelajar milik satu Pengajar, gabung lewat **Kode Kelas** |
| Skenario | `scenario` | Situasi wawancara: peran pelajar, tujuan, persona, fakta tersembunyi, rubrik, karakter |
| Versi Skenario | `scenario_version` | Snapshot skenario yang sudah terbit; tidak bisa diubah |
| Persona | `persona` | Identitas dan watak tokoh yang diperankan AI (nama, latar, gaya bicara, sikap) |
| Karakter | `character` | Model 3D VRM + suara yang "memakai" sebuah persona |
| Peran Pelajar | `learner_role` | Siapa pelajar dalam skenario (analis sistem, calon mitra bisnis, dst) |
| Fakta Tersembunyi | `fact` | Satu kebutuhan atau informasi yang harus digali; punya kategori, bobot, kesulitan, dan pemicu |
| Kesulitan | `difficulty` | 1–3: seberapa spesifik pertanyaan yang dibutuhkan untuk membuka sebuah fakta |
| Cakupan | `coverage` | Persentase bobot fakta yang berhasil digali dalam satu sesi |
| Rubrik | `rubric` | Kriteria kualitas wawancara, masing-masing dengan level 1–4 |
| Tugas | `assignment` | Skenario yang diberikan ke kelas, dengan tenggat, durasi, dan batas percobaan |
| Percobaan | `attempt` | Satu kali memulai sesi pada tugas; dihitung saat sesi dimulai |
| Pustaka Skenario | `library` | Kumpulan skenario publik untuk latihan bebas; dibatasi kuota harian |
| Sesi | `session` | Satu wawancara dari lobby sampai laporan |
| Giliran | `message` / `turn` | Satu ucapan pelajar atau karakter di transkrip |
| Mode Live | `live` | Suara dua arah realtime lewat Gemini Live |
| Mode Hemat | `fallback` | Pipeline gratis: STT browser → LLM teks → TTS browser |
| Penilaian AI | `evaluation.ai_result` | Hasil grader: fakta ditemukan, level rubrik, saran |
| Nilai Final | `final_score` | Nilai AI atau hasil override Pengajar; yang terbaik dihitung per tugas |
| Panggung | `stage` | Tampilan gelap ruang wawancara |
| Lobby | `lobby` | Layar sebelum sesi: brief, cek mic, consent |
