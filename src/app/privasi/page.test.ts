import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PrivasiPage, { metadata } from "./page";
import Home from "@/app/page";
import AppLayout from "@/app/(app)/layout";
import { SignInForm, SignUpForm } from "@/features/auth/components";
import { LobbyStart } from "@/features/interview/lobby-start";

describe("PrivasiPage", () => {
  it("defines appropriate metadata", () => {
    expect(metadata.title).toContain("Kebijakan Privasi");
    expect(typeof metadata.description).toBe("string");
    expect(metadata.description).toContain("UU PDP");
  });

  it("renders page with key sections, accurate technical descriptions, and no em-dash slop", () => {
    const html = renderToStaticMarkup(createElement(PrivasiPage));

    // Memverifikasi judul utama
    expect(html).toContain("Kebijakan Privasi");

    // Memverifikasi rujukan hukum UU PDP (docs/security-privacy.md)
    expect(html).toContain("Undang-Undang No. 27 Tahun 2022");

    // Memverifikasi jaminan ADR-004: audio mikrofon tidak pernah disimpan
    expect(html).toContain("Jaminan Utama: Rekaman Audio Mikrofon Tidak Pernah Disimpan");
    expect(html).toContain("Server kami tidak menerima maupun menyimpan rekaman audio");
    expect(html).toContain("Tidak pernah disimpan");

    // Memverifikasi akurasi teknis hash bcrypt (Finding 1 PM review)
    expect(html).toContain("hash bcrypt satu arah oleh Supabase Auth");

    // Memverifikasi akurasi hak unduh PDF laporan sesi (Finding 2 PM review)
    expect(html).toContain("format dokumen (PDF)");

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

describe("Integration Links to /privasi", () => {
  it("renders privacy policy link in home page footer", () => {
    const html = renderToStaticMarkup(createElement(Home));
    expect(html).toContain('href="/privasi"');
    expect(html).toContain("Kebijakan Privasi");
  });

  it("renders privacy policy link in AppLayout footer", () => {
    const html = renderToStaticMarkup(createElement(AppLayout, null, null));
    expect(html).toContain('href="/privasi"');
    expect(html).toContain("Kebijakan Privasi");
  });

  it("renders privacy policy link in SignInForm and SignUpForm", () => {
    const signInHtml = renderToStaticMarkup(createElement(SignInForm, {}));
    expect(signInHtml).toContain('href="/privasi"');
    expect(signInHtml).toContain("Kebijakan Privasi");

    const signUpHtml = renderToStaticMarkup(createElement(SignUpForm));
    expect(signUpHtml).toContain('href="/privasi"');
    expect(signUpHtml).toContain("Kebijakan Privasi");
  });

  it("renders privacy policy link in LobbyStart microphone consent", () => {
    const consentHtml = renderToStaticMarkup(createElement(LobbyStart, { kind: "assignment", needsConsent: true }));
    expect(consentHtml).toContain('href="/privasi"');
    expect(consentHtml).toContain('target="_blank"');
    expect(consentHtml).toContain('rel="noopener noreferrer"');
    expect(consentHtml).toContain("Kebijakan Privasi");
  });
});
