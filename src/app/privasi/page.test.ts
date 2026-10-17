import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PrivasiPage, { metadata } from "./page";

describe("PrivasiPage", () => {
  it("defines appropriate metadata", () => {
    expect(metadata.title).toContain("Kebijakan Privasi");
    expect(typeof metadata.description).toBe("string");
    expect(metadata.description).toContain("UU PDP");
  });

  it("renders page with key sections and no em-dash slop", () => {
    const el = PrivasiPage();
    const html = renderToStaticMarkup(el);

    // Memverifikasi judul utama
    expect(html).toContain("Kebijakan Privasi");

    // Memverifikasi rujukan hukum UU PDP (docs/security-privacy.md)
    expect(html).toContain("Undang-Undang No. 27 Tahun 2022");

    // Memverifikasi jaminan ADR-004: audio mikrofon tidak pernah disimpan
    expect(html).toContain("Jaminan Utama: Rekaman Audio Mikrofon Tidak Pernah Disimpan");
    expect(html).toContain("Server kami tidak menerima maupun menyimpan rekaman audio");
    expect(html).toContain("Tidak pernah disimpan");

    // Memverifikasi pihak ketiga (Google Gemini, 9router, Supabase)
    expect(html).toContain("Google (Gemini)");
    expect(html).toContain("9router");
    expect(html).toContain("Supabase");

    // Memverifikasi navigasi kembali dan ke beranda/masuk/daftar
    expect(html).toContain("Kembali ke Beranda");
    expect(html).toContain('href="/masuk"');
    expect(html).toContain('href="/daftar"');

    // Aturan antislop R-02: Dilarang menggunakan karakter em dash (—) pada teks antarmuka
    expect(html).not.toContain("—");
  });
});
