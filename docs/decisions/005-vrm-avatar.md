# ADR-005: Avatar 3D memakai preset VRM

- Status: Diterima — 2026-10-13

## Konteks

Karakter adalah pembeda utama produk ini. Ada beberapa pilihan: video avatar (HeyGen/Tavus/D-ID) mahal per menit, 2D Rive/Live2D butuh aset ilustrasi khusus, sedangkan GLB generik tidak punya standar ekspresi.

## Keputusan

- **Format VRM** dirender dengan `@pixiv/three-vrm` 3.x di React Three Fiber. VRM punya standar ekspresi `aa/ih/ou/ee/oh`, kedip, dan look-at.
- **5–8 karakter preset** dibuat di VRoid Studio dengan gaya seragam. Pengajar memilih karakter + suara per skenario.
- **Pengajar tidak bisa upload VRM sendiri di MVP.** Ini menghindari validasi file, ukuran, dan lisensi.

## Konsekuensi

- (+) Biaya runtime Rp0. Lip-sync dan ekspresi memakai standar yang sama untuk semua karakter. Jalan di mobile.
- (−) Gaya VRoid cenderung anime. Perlu kustomisasi (proporsi, tekstur, pakaian) supaya sesuai arah visual editorial dan tidak terlihat generik.
- (−) Perlu waktu produksi aset. Di M2 dimulai dengan minimal 2 karakter.
- Budget per VRM ≤ 8 MB.
