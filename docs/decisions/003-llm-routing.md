# ADR-003: Routing LLM per tugas — 9router utama, Gemini fallback

- Status: Diterima — 2026-10-13

## Konteks

Pemilik project punya 9router yang sudah di-deploy dan bisa diakses publik. 9router adalah gateway OpenAI-compatible yang menyediakan model "3.8 flash" dan model lain. Pemilik juga punya Gemini API key dari AI Studio. Keduanya ingin dipakai, baik di dev maupun production.

## Keputusan

- **Satu modul gateway** (`lib/llm/gateway.ts`) memakai SDK `openai` dengan `baseURL` yang bisa dikonfigurasi.
- **Pembagian per tugas:**

  | Tugas | Jalur |
  |---|---|
  | Chat persona (mode fallback), penilaian, generator skenario | 9router dulu, lalu Gemini (endpoint OpenAI-compatible) |
  | Suara Live | Selalu Gemini key langsung |

- **Model per tugas** diatur lewat env: `CHAT_MODEL`, `GRADER_MODEL`, `LIVE_MODEL`, `GEMINI_FALLBACK_MODEL`.
- **Pemicu fallback:** 5xx, 429, timeout, atau output yang tidak lolos validasi Zod setelah 1 retry.

## Konsekuensi

- (+) Ganti model atau provider cukup dengan mengubah env, tanpa mengubah kode. Ada redundansi.
- (−) Perilaku model bisa berbeda antara 9router dan Gemini. Prompt eval ([ai-design.md §5](../ai-design.md#5-pengujian-prompt)) wajib dijalankan di kedua model.
- (−) **Risiko ToS:** kalau 9router menyalurkan akun langganan (mis. coding assistant) untuk aplikasi publik, provider asal bisa memblokirnya. Risiko ini diterima secara sadar oleh pemilik, dan fallback Gemini menjaga layanan tetap jalan.
- Setiap panggilan dicatat di `llm_calls` untuk memantau rasio fallback.
