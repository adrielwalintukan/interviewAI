# Design System — "Editorial + Panggung"

## 1. Konsep

Ada dua dunia dalam satu produk:

- **Editorial** (dashboard, kelas, editor, laporan). Terasa seperti majalah atau buku catatan riset: kertas hangat, tipografi display yang tegas, satu aksen warna berani, banyak ruang kosong, dan grid yang sengaja asimetris.
- **Panggung** (ruang wawancara). Saat sesi dimulai, layar "meredup" menjadi panggung gelap dengan spotlight hangat pada karakter. Transisinya adalah momen sinematik produk ini.

Metafora: pelajar adalah *jurnalis/analis* yang mencatat; karakter adalah *narasumber* di atas panggung.

## 2. Aturan anti-AI-slop

**Dilarang:**

- Gradien ungu-biru, "aurora blob", atau glow neon generik.
- Glassmorphism sebagai gaya default (project lama memakainya).
- Ikon emoji sebagai ikon UI. Ilustrasi 3D "clay" generik.
- Grid kartu yang seragam 3 kolom dengan ikon + judul + 2 baris teks.
- Hero berisi "Revolutionize your ... with AI ✨". Kata "AI-powered" di mana-mana.
- Shadow besar yang blur di semua elemen. Radius 2xl di semua elemen.
- Animasi fade-in-up yang sama untuk setiap elemen saat scroll.

**Dianjurkan:**

- **Tipografi sebagai elemen visual utama.** Judul display besar, angka nilai bergaya tabel majalah.
- **Garis tipis (hairline rules)**, nomor bagian ("01 — Persona"), dan anotasi di margin.
- **Tekstur grain halus** (SVG noise, opacity 3–5%) di permukaan kertas.
- **Ilustrasi tangan / coretan stabilo** untuk penekanan, mis. menandai fakta yang ditemukan.
- **Copy yang konkret dan hangat.** Contoh: "Bu Ratna sudah menunggu di ruang meeting", bukan "Start AI session".

## 3. Tokens

### 3.1 Warna

Didefinisikan sebagai CSS variables di `@theme` Tailwind v4. Semua pasangan teks/latar wajib lolos WCAG AA.

| Token | Light (editorial) | Peran |
|---|---|---|
| `--paper` | `#F4EFE6` | Latar utama |
| `--paper-2` | `#EAE3D6` | Panel, sidebar |
| `--ink` | `#1B1A17` | Teks utama |
| `--ink-2` | `#5B574F` | Teks sekunder |
| `--rule` | `#D3CABA` | Garis, border |
| `--accent` | `#D9432B` (vermilion) | CTA, fokus, highlight utama. **Dipakai hemat** |
| `--accent-ink` | `#FFF8F0` | Teks di atas aksen |
| `--moss` | `#2F5D50` | Status sukses, fakta ditemukan |
| `--ochre` | `#C8902E` | Peringatan, tenggat dekat |
| `--highlight` | `#F6D365` | Efek stabilo (mix-blend multiply) |

| Token | Stage (dark) | Peran |
|---|---|---|
| `--stage` | `#0E0D0B` | Latar panggung |
| `--stage-2` | `#1A1814` | Panel transkrip |
| `--spot` | `#FFD9A8` | Warna spotlight (radial, opacity rendah) |
| `--stage-ink` | `#EDE6DA` | Teks |
| `--stage-ink-2` | `#9A9285` | Teks sekunder |
| `--live` | `#E5574A` | Indikator rekam / mendengar |

### 3.2 Tipografi

| Peran | Font | Catatan |
|---|---|---|
| Display | **Fraunces** (variable, opsz + SOFT) | Judul, angka nilai, nama karakter |
| Teks/UI | **Plus Jakarta Sans** | Karya desainer Indonesia, nyaman dibaca dalam Bahasa Indonesia |
| Mono | **JetBrains Mono** | Timer, kode kelas, label teknis |

Semua font dimuat lewat `next/font` (self-hosted) dengan `display: swap`.

Skala tipe (fluid, `clamp`):

| Token | Ukuran |
|---|---|
| `display-xl` | 56→96 px |
| `display` | 40→64 px |
| `h1` | 32→40 px |
| `h2` | 24→28 px |
| `body` | 16 px / line-height 1.6 |
| `small` | 14 px |
| `label` | 12 px, uppercase, tracking 0.08em |

### 3.3 Spacing, radius, elevasi

- **Spacing:** basis 4 px (`1 = 4px`). Ritme section memakai 64 / 96 / 128.
- **Radius:**
  - `sm` 6 px untuk input dan tombol.
  - `md` 10 px untuk panel.
  - `full` hanya untuk mic button dan avatar thumbnail.
- **Elevasi:** utamakan hairline border dan perbedaan warna permukaan. Hanya ada satu shadow (`0 1px 0 var(--rule), 0 12px 24px -16px rgb(27 26 23 / .25)`), khusus untuk elemen yang mengambang (popover, sheet).

## 4. Motion

Library: **Motion** (`motion/react`). Prinsip: gerak punya makna (menjelaskan perubahan state), bukan dekorasi.

| Token | Durasi | Easing | Pemakaian |
|---|---|---|---|
| `instant` | 120 ms | `ease-out` | hover, toggle |
| `quick` | 200 ms | `cubic-bezier(.2,.8,.2,1)` | dropdown, tooltip |
| `base` | 320 ms | `cubic-bezier(.2,.8,.2,1)` | panel, sheet, list reorder |
| `scene` | 900 ms | `cubic-bezier(.65,0,.35,1)` | transisi editorial → panggung |
| spring | `stiffness 260, damping 26` | | mic button, indikator |

Momen bertanda tangan (signature moments):

1. **Masuk panggung.** Kertas "terlipat" ke gelap lewat clip-path dari tombol Mulai. Lampu spotlight menyala dengan sedikit flicker (2 frame), lalu karakter mengangkat kepala dan menyapa.
2. **Fakta ditemukan** (di laporan). Teks fakta di-"stabilo" kiri→kanan (scaleX pada `--highlight`), stagger 80 ms.
3. **Angka nilai.** Count-up dengan font tabular dan sedikit overshoot.
4. **Mic button.** Bentuk "bernapas" mengikuti level input mic. Saat Thinking, berubah menjadi tiga titik yang berputar.
5. **View transitions** antar halaman editorial memakai View Transition API (fallback: crossfade).

Aturan:

- **Reduced motion.** `prefers-reduced-motion: reduce` mematikan transisi scene, count-up, dan stabilo (langsung ke state akhir). Animasi avatar cukup dikurangi ke kedip + lip-sync.
- **Properti yang dianimasikan.** Hanya `transform`, `opacity`, `clip-path`, dan `filter` ringan. Jangan animasikan layout di daftar panjang.

## 5. Komponen kunci

| Komponen | Deskripsi | State |
|---|---|---|
| `Stage` | Layout panggung: kanvas avatar, spotlight, vignette, HUD (timer, mode, akhiri) | live / fallback / ending |
| `AvatarViewport` | Kanvas R3F + VRM; kamera framing setengah badan; look-at | loading (siluet + shimmer), idle, listening, thinking, speaking |
| `MicButton` | Tombol utama; push-to-talk opsional (tahan Spasi) | idle, listening (level), thinking, speaking (nonaktif/barge-in), muted, unsupported |
| `LiveTranscript` | Gelembung tanpa "chat bubble" generik; format naskah wawancara: **NAMA** — ucapan | streaming (teks parsial pudar), final |
| `ModeBadge` | "Live" / "Mode hemat" dengan tooltip penjelasan | — |
| `ScoreReport` | Angka besar + rubrik bergaya tabel majalah + daftar fakta (stabilo) + saran pertanyaan | ai-only, reviewed |
| `ScenarioEditor` | Editor bertahap bernomor (01 Brief, 02 Persona, 03 Fakta, 04 Rubrik, 05 Karakter, 06 Uji coba) dengan autosave | draft, generating, published |
| `FactCard` | Kartu fakta dengan bobot (●●○) & kesulitan | — |
| `ClassCode` | Kode mono besar + salin + regenerasi | — |
| `EmptyState` | Ilustrasi coretan + 1 kalimat + 1 aksi | — |

Basisnya shadcn/ui, tapi semua komponen di-restyle memakai tokens di atas. Tidak boleh ada tampilan default shadcn (abu-abu zinc) yang lolos ke produksi.

## 6. Layout responsif

| Breakpoint | Editorial | Panggung |
|---|---|---|
| < 640 (mobile) | Satu kolom; nav di bawah (4 item) | Avatar 60% tinggi layar di atas; transkrip sebagai **bottom sheet** (bisa ditarik); mic button besar di tengah bawah, dekat jempol |
| 640–1024 (tablet) | Dua kolom fleksibel | Avatar kiri 55%, transkrip kanan |
| ≥ 1024 (desktop) | Grid 12 kolom asimetris; sidebar kiri | Avatar tengah dengan transkrip di kolom kanan; catatan brief bisa dibuka di kiri |

- **Safe area.** Hormati `env(safe-area-inset-*)`.
- **Ukuran target sentuh.** Minimal 44×44 px.
- **Uji layar kecil.** Panggung tetap dapat dipakai di 360×640 dengan keyboard virtual terbuka (input teks menempel di atas keyboard).

## 7. Aksesibilitas

- **Kontras & fokus.** Kontras minimal WCAG 2.2 AA. Fokus terlihat jelas (outline 2 px `--accent`, offset 2 px).
- **Keyboard.** Semua aksi bisa dijalankan dari keyboard:
  - `Spasi` = push-to-talk (opsional).
  - `Enter` = kirim teks.
  - `Esc` = buka dialog Akhiri.
- **Caption.** Transkrip live berfungsi sebagai caption. Region transkrip memakai `aria-live="polite"`.
- **Pengguna tanpa mikrofon / tunarungu.** Mode teks penuh tersedia dan setara dengan mode suara.
- **Avatar.** Avatar bersifat dekoratif (`aria-hidden`). State karakter diumumkan lewat teks ("Bu Ratna sedang berpikir").
- **Bahasa.** Atribut `lang` diset per bahasa wawancara pada region transkrip.

## 8. Suara copy (UI Bahasa Indonesia)

- **Gaya bahasa.** Pakai "kamu" untuk pelajar dan "Anda" untuk pengajar & admin. Kalimat pendek dan aktif.
- **Contoh.**
  - Tombol mulai: "Masuk ruang wawancara".
  - Mode hemat: "Koneksi suara sedang penuh. Kami pindah ke mode hemat; wawancara tetap lanjut."
- **Pesan error.** Jelaskan apa yang terjadi, lalu apa yang bisa dilakukan. Jangan pernah menampilkan kode error mentah.
- **Judul menyebut isi halaman** ("Pustaka skenario", "Ganti password"), bukan slogan ("Klien dari ruang kelas lain."). Tanpa titik di akhir judul.
- **Label kecil di atas judul** hanya dipakai bila menambah konteks (mis. "Admin" di atas "Karakter"). Jangan mengulang judul, dan jangan memakai label dekoratif tanpa isi ("Catatan pinggir").
- **Tanpa tanda pisah (—) di tengah kalimat.** Pecah jadi dua kalimat, atau pakai koma/titik koma. Tanda pisah boleh untuk nomor bagian ("01 — Tugas") dan pemisah judul.
- **Tanpa istilah internal** (nama milestone, nama provider, istilah teknis) di teks untuk pelajar dan pengajar.

## 9. Aset karakter

- **Jumlah & gaya.** 5–8 VRM dari VRoid Studio dengan gaya yang seragam: proporsi semi-realistis, bukan chibi, palet pakaian mengikuti tokens.
- **Variasi.** Usia, gender, dan profesi beragam: pemilik UMKM, manajer, kepala sekolah, petani modern, dan lainnya.
- **Thumbnail.** Setiap karakter punya thumbnail potret bergaya ilustrasi (duotone ink + paper) untuk tampilan editorial.
