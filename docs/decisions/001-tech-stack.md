# ADR-001: Next.js + Supabase sebagai stack utama

- Status: Diterima — 2026-10-13

## Konteks

Project dikerjakan oleh tim kecil (1–2 orang) untuk skala kelas, dengan biaya Rp0 (free tier). Kebutuhannya: UI beranimasi yang kaya, avatar 3D, auth dengan role, database relasional dengan isolasi data per pengguna, dan deploy yang mudah. Project lama (HTML statis + Express + JSON) tidak punya fondasi untuk auth maupun data.

## Keputusan

- **Next.js 16** (App Router, TypeScript, line LTS).
- **Tailwind v4 + shadcn/ui** (dikustom) + **Motion**.
- **React Three Fiber + @pixiv/three-vrm 3.x** untuk avatar.
- **Supabase** (Postgres, Auth, RLS, Storage).
- **Vercel** untuk hosting.

## Alternatif

- **SvelteKit:** bundle lebih kecil, tapi ekosistem 3D dan komponennya lebih kecil.
- **Vite SPA + Hono:** kontrolnya lebih besar, tapi ada dua deploy dan auth harus dirakit sendiri.

## Konsekuensi

- (+) Satu repo dan satu deploy. RLS memberi isolasi data di level database. Semua lapisan punya free tier.
- (−) Vercel serverless tidak cocok untuk WebSocket jangka panjang. Akibatnya, relay suara di server (kalau dibutuhkan, lihat ADR-002) harus berjalan di host lain.
- (−) Free tier Supabase menjeda project yang tidak aktif. Perlu dibuat aktif atau di-upgrade saat pilot.
