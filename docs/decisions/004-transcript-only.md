# ADR-004: Hanya transkrip yang disimpan, audio tidak

- Status: Diterima — 2026-10-13

## Konteks

Sebagian pengguna adalah siswa di bawah umur, sehingga UU PDP relevan. Rekaman suara adalah data pribadi yang sensitif dan mahal untuk disimpan. Penilaian cukup memakai teks.

## Keputusan

- Audio tidak pernah melewati maupun disimpan di server kita. Yang disimpan hanya transkrip per giliran, nilai, dan komentar.
- Ada consent mikrofon sekali per akun.
- Data pelajar bisa dihapus permanen oleh Admin.
- Retensi: sampai akun dihapus, atau kelas diarsipkan + 1 tahun.

## Konsekuensi

- (+) Risiko privasi dan biaya storage kecil. Arsitekturnya sederhana.
- (−) Pengajar tidak bisa menilai intonasi atau kelancaran bicara. Kualitas transkripsi (STT) memengaruhi penilaian.
- **Pemicu revisi:** institusi meminta penilaian aspek lisan. Kalau itu terjadi, tambahkan rekaman opsional per tugas dengan consent terpisah.
