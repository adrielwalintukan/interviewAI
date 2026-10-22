# Spesifikasi Karakter VRM

Panduan membuat 6 karakter preset di **VRoid Studio** (gratis). Dipakai oleh M3: ruang wawancara, lip-sync, dan ekspresi. Keputusan terkait ada di [ADR-005](decisions/005-vrm-avatar.md) dan [design-system §9](design-system.md#9-aset-karakter).

## 1. Daftar karakter

ID harus sama persis dengan tabel `characters`, karena nama file = ID.

| ID / file | Nama | Profesi | Usia | Gender | Suara (Gemini) | Arah gaya |
|---|---|---|---|---|---|---|
| `ratna.vrm` | Bu Ratna | Pemilik usaha laundry | 40-an | P | Aoede | Hangat, praktis; blus batik sederhana, rambut diikat |
| `hendra.vrm` | Pak Hendra | Manajer gudang distribusi | 50-an | L | Charon | Tegas; kemeja lengan panjang + rompi kerja, uban tipis |
| `nadia.vrm` | Kak Nadia | Pemilik kafe | 20-an | P | Leda | Ceria; apron kafe di atas kaus, rambut sebahu |
| `yosef.vrm` | Pak Yosef | Kepala sekolah | 50-an | L | Orus | Formal; kemeja safari/PDH, kacamata |
| `sri.vrm` | Bu Sri | Ketua koperasi tani | 40-an | P | Kore | Lugas; kemeja lapangan + kerudung |
| `dimas.vrm` | Mas Dimas | Founder startup logistik | 30-an | L | Puck | Energik; kemeja flanel/hoodie, jam tangan pintar |

**Keragaman yang diwajibkan:** warna kulit Asia Tenggara yang beragam (jangan semuanya kulit terang ala anime), bentuk wajah dan tinggi berbeda, dan tidak ada stereotip berlebihan.

## 2. Gaya visual (anti generik)

- **Semi-realistis, bukan chibi atau anime ekstrem.** Di VRoid:
  - Kecilkan ukuran mata (±70–80% default) dan perkecil iris.
  - Proporsi kepala dewasa (kepala ± 1/7 tinggi badan).
  - Hidung dan mulut sedikit lebih tegas daripada default.
- **Palet pakaian** mengikuti token desain: kertas `#F4EFE6`, tinta `#1B1A17`, dan aksen yang selaras dengan `portrait_hue` tiap karakter (hue ≈ 18 Ratna, 210 Hendra, 340 Nadia, 150 Yosef, 95 Sri, 265 Dimas). Hindari neon.
- **Hindari:** aksesori fantasi, telinga hewan, rambut warna mencolok, efek glow.
- **Framing kamera aplikasi** adalah setengah badan (kepala sampai pinggang), jadi detail paling penting ada di wajah, rambut, dan pakaian atas.

## 3. Syarat teknis (wajib)

| Item | Syarat |
|---|---|
| Versi | Export **VRM 1.0** dari VRoid Studio v2.x |
| Ekspresi | Preset VRM 1.0 lengkap: `aa`, `ih`, `ou`, `ee`, `oh` (lip-sync), `blink`, `blinkLeft`, `blinkRight`, `happy`, `angry`, `sad`, `relaxed`, `surprised`, `neutral`. VRoid membuatnya otomatis; **jangan dihapus**. Cek di tab Ekspresi bahwa `aa/ih/ou/ee/oh` menggerakkan mulut dengan jelas |
| Look-at | Biarkan default (bone/eye look-at aktif) |
| Ukuran file | **≤ 8 MB** per file |
| Tekstur | Atlas **≤ 1024×1024**. VRoid 2.14 hanya menawarkan 2048/4096: export 2048, lalu `npm run vrm:optimize` (§6) mengecilkannya. Materials 8 |
| Poligon | Gunakan opsi "Reduce polygons" dan "Delete transparent meshes" saat export. Target < 40k segitiga |
| Spring bone | Hanya rambut dan ujung pakaian. Jumlah kecil, agar ringan di HP |
| Pose | Pose default (T/A-pose); animasi idle dibuat di aplikasi |

## 4. Metadata & lisensi (wajib diisi saat export)

- **Title:** nama karakter. **Author:** nama Anda/institusi.
- **Avatar permission:** "Only author" atau "Everyone" (sesuai keinginan).
- **Commercial usage:** **Allow** (izinkan), supaya aman jika aplikasi dipakai institusi.
- **Hanya memakai aset bawaan VRoid Studio.** Jangan memakai item BOOTH atau VRoid Hub milik orang lain tanpa mengecek lisensinya satu per satu.

## 5. Checklist sebelum diserahkan

- [ ] Nama file persis `ratna.vrm`, `hendra.vrm`, dst.
- [ ] Bisa dibuka ulang di VRoid Studio (Import) atau viewer VRM lain tanpa error
- [ ] Ekspresi `aa/ih/ou/ee/oh` dan `blink` terlihat jelas
- [ ] Ukuran ≤ 8 MB
- [ ] Dari depan setengah badan, karakter sesuai deskripsi (usia, profesi, gaya)
- [ ] Metadata lisensi terisi

## 6. Cara menyerahkan

Letakkan file `.vrm` di satu folder lokal (di luar repo), lalu:

1. **Rapikan:** `npm run vrm:optimize -- "<folder>"`. VRoid Studio 2.x hanya menawarkan atlas 2048/4096 dan menyimpan setiap ekspresi wajah secara penuh, sehingga hasil export biasanya 9–12 MB. Skrip `scripts/optimize-vrm.mjs` mengecilkan tekstur > 1024 menjadi 1024 dan menyimpan data ekspresi sebagai *sparse accessor* glTF (hanya titik yang bergerak; nilainya diperiksa ulang dan identik). Hasilnya di `<folder>/optimized/`, dan skrip gagal bila ada syarat §3 yang tidak terpenuhi. Hasil 2026-10-22: 2,7–4,2 MB per karakter.
2. **Unggah** keenam file dari `optimized/` ke Supabase Storage bucket `characters` (Dashboard → Storage), dengan nama file = id. Bucket dan `characters.vrm_path` dibuat oleh migrasi `20261028000000_character_storage.sql`; hanya service role/Dashboard yang bisa menulis.
3. Ruang wawancara dan pratinjau editor otomatis memakai 3D. Karakter tanpa file, atau file yang gagal dimuat, tetap tampil sebagai potret CSS.
