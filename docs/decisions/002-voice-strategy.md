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
