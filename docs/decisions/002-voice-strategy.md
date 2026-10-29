# ADR-002: Gemini Live sebagai jalur suara utama, dengan fallback pipeline gratis

- Status: Diterima — 2026-10-13

## Konteks

Pemilik project ingin percakapan voice-to-voice realtime, **asalkan gratis**. Kondisinya:

- Gemini Live API punya free tier, tapi batasnya tidak dipublikasikan resmi, dan ada laporan penolakan 429 di project free tier.
- OpenAI Realtime berbayar.
- Lip-sync butuh audio yang bisa dianalisis, dan `speechSynthesis` tidak menyediakannya.

## Keputusan

1. **Jalur utama: Gemini Live.** Browser terhubung langsung memakai **ephemeral token** yang diterbitkan server, dengan konfigurasi persona dikunci di server. Audio PCM yang keluar dianalisis untuk lip-sync.
2. **Fallback otomatis, satu arah per sesi.** Fallback dipicu oleh gagal connect dalam 5 detik, 429/kuota, atau koneksi putus. Pipelinenya: Web Speech STT → LLM teks (ADR-003) → `speechSynthesis`, dengan lip-sync perkiraan dari teks. Transkrip ikut dibawa.
3. **Input teks** selalu tersedia di kedua mode.

## Alternatif

- **Pipeline gratis saja:** stabil, tapi suaranya robotik dan tidak realtime.
- **Billing Gemini Live:** kualitasnya konsisten, tapi tidak Rp0. Tetap menjadi opsi di masa depan, dengan spending cap.
- **Relay WebSocket di server:** server mengendalikan prompt dan transkrip sepenuhnya, tapi butuh host non-Vercel (Railway/Fly) dan menambah latensi.

## Konsekuensi

- (+) Biaya Rp0, dan pengalaman terbaik saat kuota tersedia.
- (−) Dua jalur suara harus dites. Kualitas fallback lebih rendah (terutama di Safari/Firefox).
- (−) Transkrip mode Live berasal dari client, jadi bisa dipalsukan. Mitigasinya ada di [architecture.md §3.3](../architecture.md#33-kepercayaan-transkrip).
- **Hasil spike 2026-10-14:** ephemeral token **berhasil mengunci** `systemInstruction` (setup lengkap di token, tanpa `fieldMask`; setup dari client diabaikan). Token tidak membawa isi prompt dan benar sekali pakai. **Relay di AWS tidak dibutuhkan** untuk menjaga kerahasiaan prompt. Relay tetap jadi opsi untuk kepercayaan transkrip (ujian). Detail: `docs/architecture.md` §3.1.
- **Rencana relay (kalau dibutuhkan):**
  - Host: VPS AWS milik pemilik project (credit $100 untuk 6 bulan, jadi target biaya ≤ $15/bulan). Region sebaiknya terdekat dengan pengguna (Jakarta/Singapura).
  - Bentuk: Node + `ws` dalam Docker, dengan TLS di domain sendiri.
  - Infrastruktur ditulis sebagai IaC (CDK/CloudFormation), bukan setup manual.
  - Browser ↔ relay ↔ Gemini Live. Relay memegang API key, mengirim persona, dan mencatat transkrip sendiri.
  - Diputuskan 2026-10-13: relay **tidak** dibangun di awal. Relay hanya dibangun kalau spike M3 gagal atau pemicu di bawah terjadi.
- **Pemicu revisi:**
  - Constraints token ternyata tidak bisa mengunci `systemInstruction` → pindah ke relay di AWS.
  - Tingkat fallback di atas 30% → pertimbangkan billing.
  - Dipakai untuk ujian bernilai tinggi → relay server.
- **Amandemen 2026-10-14 (suara mode hemat):** `speechSynthesis` diganti **Gemini TTS** (`TTS_MODEL`) dengan nama suara yang sama dengan karakter di Live. Alasan: uji nyata menunjukkan suara browser membaca kalimat Indonesia dengan pelafalan Inggris bila perangkat tidak punya suara id-ID, dan gender suaranya bisa tidak cocok dengan karakter. Konsekuensi: mode hemat kini memakai kuota Gemini (TTS) per jawaban karakter; bila TTS gagal/kuota habis, jawaban tampil sebagai teks saja (tidak memakai suara browser). Mendengar ucapan pelajar tetap memakai Web Speech API.
- **Amandemen 2026-10-29 (cadangan Deepgram untuk mode hemat):** karena kuota Google AI Studio mudah habis dan mode hemat memakai kuota Gemini TTS yang sama, **Deepgram Flux TTS** ditambahkan sebagai **cadangan** saat Gemini TTS gagal (429/kuota/5xx/timeout). Gemini tetap provider utama; urutannya Gemini → Deepgram → teks saja. Deepgram Aura tidak dipakai karena tidak punya suara Indonesia; Flux TTS punya (`flux-dewi-id`, `flux-fitri-id`, `flux-fajar-id`, `flux-rizky-id`, `flux-teguh-id`), meski masih Early Access (5 suara, belum ada normalisasi teks). Live tidak tersentuh: suaranya dihasilkan model Gemini, bukan TTS. Aktif hanya bila `DEEPGRAM_API_KEY` diisi; tanpa key, perilakunya sama seperti amandemen sebelumnya. Kualitas suara Indonesia Deepgram **belum diverifikasi** dengan uji mendengar (key belum diisi saat implementasi).
