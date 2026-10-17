import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button-class";

export const metadata: Metadata = {
  title: "Kebijakan Privasi - Interview AI",
  description:
    "Kebijakan privasi Interview AI: perlindungan data pelajar, jaminan tidak menyimpan rekaman audio suara, dan prinsip kepatuhan UU PDP.",
};

export default function PrivasiPage() {
  return (
    <div className="grain min-h-dvh">
      {/* Header navigasi */}
      <header className="mx-auto flex max-w-4xl items-center justify-between border-b border-rule px-4 py-4 sm:px-8">
        <Link href="/" className="inline-flex min-h-11 items-center font-display text-xl font-semibold tracking-tight">
          Interview AI
        </Link>
        <nav className="flex items-center gap-3">
          <Link href="/masuk" className="inline-flex min-h-11 items-center px-3 text-sm text-ink-2 hover:text-ink">
            Masuk
          </Link>
          <Link href="/daftar" className={buttonClass("primary", "text-sm")}>
            Daftar
          </Link>
        </nav>
      </header>

      {/* Konten Kebijakan Privasi */}
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-8 sm:py-16">
        <article className="space-y-10">
          <header className="border-b border-rule pb-8">
            <p className="font-mono text-label uppercase text-accent">Dokumen Resmi</p>
            <h1 className="mt-2 font-display text-display font-medium tracking-tight">
              Kebijakan Privasi
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-ink-2">
              Interview AI dirancang sebagai ruang latihan wawancara elisitasi kebutuhan bagi pelajar sekolah dan mahasiswa.
              Kami mengutamakan pelindungan data pribadi dan transparansi penuh sesuai prinsip Undang-Undang No. 27 Tahun 2022
              tentang Pelindungan Data Pribadi (UU PDP).
            </p>
            <p className="mt-2 font-mono text-xs text-ink-2">
              Terakhir diperbarui: Oktober 2026
            </p>
          </header>

          {/* Kotak Jaminan Suara (ADR-004) */}
          <section className="rounded-md border border-moss/40 bg-moss/5 p-5 text-sm leading-relaxed">
            <h2 className="font-display text-base font-semibold text-moss">
              Jaminan Utama: Rekaman Audio Mikrofon Tidak Pernah Disimpan
            </h2>
            <p className="mt-2 text-ink">
              Server kami tidak menerima maupun menyimpan rekaman audio dari mikrofon perangkat kamu.
              Suara hanya dialirkan secara langsung untuk proses percakapan AI waktu-nyata atau diubah menjadi teks melalui
              peramban. Yang disimpan dalam sistem kami hanyalah transkrip teks percakapan untuk keperluan penilaian belajar.
            </p>
          </section>

          {/* 1. Rincian Data */}
          <section className="space-y-4">
            <h2 className="font-display text-2xl font-medium tracking-tight">
              1. Rincian Data Pengguna
            </h2>
            <p className="text-ink leading-relaxed">
              Kami menerapkan prinsip minimisasi data. Kami hanya mengumpulkan informasi yang benar-benar dibutuhkan
              untuk menjalankan simulasi wawancara dan evaluasi pembelajaran.
            </p>

            <div className="overflow-x-auto rounded-md border border-rule">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-rule bg-paper-2 font-mono text-xs uppercase text-ink-2">
                  <tr>
                    <th className="px-4 py-3">Jenis Data</th>
                    <th className="px-4 py-3">Status Penyimpanan</th>
                    <th className="px-4 py-3">Tujuan Penggunaan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule bg-paper">
                  <tr>
                    <td className="px-4 py-3 font-medium">Nama tampilan, email / username</td>
                    <td className="px-4 py-3 text-moss font-medium">Disimpan</td>
                    <td className="px-4 py-3 text-ink-2">Identitas akun dan akses masuk ke kelas</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">Transkrip teks wawancara</td>
                    <td className="px-4 py-3 text-moss font-medium">Disimpan</td>
                    <td className="px-4 py-3 text-ink-2">Bahan penilaian dan peninjauan hasil wawancara</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">Nilai, rubrik, dan komentar</td>
                    <td className="px-4 py-3 text-moss font-medium">Disimpan</td>
                    <td className="px-4 py-3 text-ink-2">Umpan balik evaluasi dari AI dan pengajar</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">Audio mikrofon (suara rekaman)</td>
                    <td className="px-4 py-3 text-accent font-medium">Tidak pernah disimpan</td>
                    <td className="px-4 py-3 text-ink-2">Hanya diproses langsung saat percakapan berlangsung</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">Foto, tanggal lahir, nomor HP, alamat</td>
                    <td className="px-4 py-3 text-accent font-medium">Tidak dikumpulkan</td>
                    <td className="px-4 py-3 text-ink-2">Tidak dibutuhkan untuk kegiatan latihan</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">Kata sandi akun</td>
                    <td className="px-4 py-3 text-ink font-medium">Hanya hash satu arah</td>
                    <td className="px-4 py-3 text-ink-2">Dienkripsi dengan bcrypt oleh Supabase Auth, tidak bisa dibaca siapa pun</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">Metadata teknis sistem</td>
                    <td className="px-4 py-3 text-moss font-medium">Disimpan (tanpa isi teks)</td>
                    <td className="px-4 py-3 text-ink-2">Pemantauan latensi, kuota, dan kestabilan panggilan AI</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 2. Pihak Ketiga */}
          <section className="space-y-3">
            <h2 className="font-display text-2xl font-medium tracking-tight">
              2. Pemrosesan oleh Pihak Ketiga
            </h2>
            <p className="text-ink leading-relaxed">
              Untuk menggerakkan karakter AI dan memproses suara secara interaktif, data sesi diteruskan ke penyedia kecerdasan buatan pihak ketiga:
            </p>
            <ul className="list-disc space-y-2 pl-5 text-ink-2">
              <li>
                <strong className="text-ink">Google (Gemini):</strong> Digunakan untuk pemrosesan bahasa alami, evaluasi rubrik, dan koneksi suara langsung (Gemini Live). Koneksi audio menggunakan token sementara (ephemeral token) sekali pakai yang langsung kedaluwarsa setelah sesi selesai.
              </li>
              <li>
                <strong className="text-ink">Penyedia perutean AI (9router):</strong> Digunakan sebagai jalur distribusi model cadangan untuk menjaga ketersediaan layanan saat kuota utama penuh.
              </li>
              <li>
                <strong className="text-ink">Supabase:</strong> Penyedia basis data terkelola dan sistem autentikasi aman dengan isolasi tingkat baris (Row-Level Security / RLS).
              </li>
            </ul>
          </section>

          {/* 3. Persetujuan & Mode Alternatif */}
          <section className="space-y-3">
            <h2 className="font-display text-2xl font-medium tracking-tight">
              3. Persetujuan Mikrofon dan Aksesibilitas
            </h2>
            <p className="text-ink leading-relaxed">
              Sebelum memulai sesi wawancara suara untuk pertama kali, platform akan meminta persetujuan penggunaan mikrofon.
              Persetujuan ini bersifat sukarela:
            </p>
            <ul className="list-disc space-y-2 pl-5 text-ink-2">
              <li>
                Jika kamu memilih tidak menggunakan mikrofon atau perangkat kamu tidak mendukung audio, kamu tetap dapat menyelesaikan seluruh tugas wawancara elisitasi menggunakan mode teks (ketik) dengan bobot penilaian yang sama persis.
              </li>
              <li>
                Untuk siswa di bawah umur yang didaftarkan melalui pembuatan akun massal oleh institusi sekolah, persetujuan orang tua atau wali dikoordinasikan langsung oleh pihak sekolah pengelola.
              </li>
            </ul>
          </section>

          {/* 4. Masa Simpan & Hak Pengguna */}
          <section className="space-y-3">
            <h2 className="font-display text-2xl font-medium tracking-tight">
              4. Masa Simpan Data dan Hak Pengguna
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-md border border-rule bg-paper-2 p-4">
                <h3 className="font-display text-lg font-medium text-ink">Berapa Lama Data Disimpan?</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-2">
                  Transkrip dan nilai disimpan selama akun aktif, atau hingga kelas diarsipkan ditambah 1 tahun. Setelah periode tersebut, data riwayat sesi akan dibersihkan secara otomatis.
                </p>
              </div>
              <div className="rounded-md border border-rule bg-paper-2 p-4">
                <h3 className="font-display text-lg font-medium text-ink">Hak Unduh dan Hapus</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-2">
                  Pelajar berhak melihat dan mengunduh transkrip percakapan mereka sendiri. Permintaan penghapusan akun permanen dapat diajukan kepada administrator sekolah, yang akan menghapus data secara menyeluruh (cascade).
                </p>
              </div>
            </div>
          </section>

          {/* 5. Keamanan & Kerahasiaan Skenario */}
          <section className="space-y-3">
            <h2 className="font-display text-2xl font-medium tracking-tight">
              5. Keamanan dan Kerahasiaan Skenario
            </h2>
            <p className="text-ink leading-relaxed">
              Data skenario latihan memiliki proteksi berlapis. Fakta tersembunyi, instruksi persona karakter, dan rubrik rahasia dikunci di server dan tidak pernah dikirimkan ke peramban pelajar. Hal ini memastikan proses latihan elisitasi berjalan objektif dan adil bagi seluruh peserta.
            </p>
          </section>

          {/* 6. Kontak & Pertanyaan */}
          <section className="rounded-md border border-rule bg-paper-2 p-5 space-y-3">
            <h2 className="font-display text-xl font-medium tracking-tight">
              6. Kontak dan Pertanyaan Privasi
            </h2>
            <p className="text-sm leading-relaxed text-ink-2">
              Jika kamu memiliki pertanyaan mengenai data pembelajaran, ingin meminta penghapusan akun, atau menyampaikan kendala terkait privasi:
            </p>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-2">
              <li>
                <strong className="text-ink">Pelajar dan Orang Tua:</strong> Silakan hubungi Pengajar atau Administrator Sekolah / Kampus tempat kelas kamu terdaftar.
              </li>
              <li>
                <strong className="text-ink">Pengelola Institusi & Teknis:</strong> Untuk pertanyaan teknis implementasi platform atau laporan keamanan, hubungi tim pengembang proyek Interview AI melalui halaman repositori resmi.
              </li>
            </ul>
          </section>

          <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-rule pt-6 text-sm text-ink-2">
            <Link href="/" className="inline-flex min-h-11 items-center underline-offset-4 hover:text-ink hover:underline">
              ← Kembali ke Beranda
            </Link>
            <p className="font-mono text-xs">Interview AI - Platform Latihan Elisitasi Kebutuhan</p>
          </footer>
        </article>
      </main>
    </div>
  );
}
