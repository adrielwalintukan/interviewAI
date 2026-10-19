import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveConnection, STALL_MS, type LiveHandlers } from "./live-client";

class FakeSocket {
  static OPEN = 1;
  static last: FakeSocket;
  readyState = 1;
  sent: unknown[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => Promise<void>) | null = null;
  onclose: ((ev: { code: number; reason: string }) => void) | null = null;
  constructor() {
    FakeSocket.last = this;
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {}
  emit(msg: unknown) {
    return this.onmessage!({ data: JSON.stringify(msg) });
  }
}

function connect() {
  const h = {
    onReady: vi.fn(),
    onAudio: vi.fn(),
    onInputText: vi.fn(),
    onOutputText: vi.fn(),
    onTurnComplete: vi.fn(),
    onInterrupted: vi.fn(),
    onStall: vi.fn(),
    onClose: vi.fn(),
  } satisfies LiveHandlers;
  const conn = new LiveConnection("t", "models/m", h);
  return { conn, h, ws: FakeSocket.last };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", FakeSocket);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("LiveConnection stall watchdog", () => {
  it("reports a stall when the learner was transcribed but the character never answers (2026-10-18 bug)", async () => {
    const { h, ws } = connect();
    await ws.emit({ serverContent: { inputTranscription: { text: "Apakah Anda bersedia?" } } });
    vi.advanceTimersByTime(STALL_MS - 1);
    expect(h.onStall).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(h.onStall).toHaveBeenCalledOnce();
  });

  it("restarts the wait while the learner keeps talking", async () => {
    const { h, ws } = connect();
    await ws.emit({ serverContent: { inputTranscription: { text: "Halo." } } });
    vi.advanceTimersByTime(STALL_MS - 1000);
    await ws.emit({ serverContent: { inputTranscription: { text: " Nadia?" } } });
    vi.advanceTimersByTime(STALL_MS - 1000);
    expect(h.onStall).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(h.onStall).toHaveBeenCalledOnce();
  });

  it("does not fire when the character answers, even in the same message as the transcription", async () => {
    const { h, ws } = connect();
    await ws.emit({ serverContent: { inputTranscription: { text: "Halo." } } });
    await ws.emit({ serverContent: { outputTranscription: { text: "Halo juga." } } });
    await ws.emit({ serverContent: { inputTranscription: { text: "Boleh tanya?" }, modelTurn: { parts: [{ inlineData: { data: "AAAA" } }] } } });
    vi.advanceTimersByTime(STALL_MS * 2);
    expect(h.onStall).not.toHaveBeenCalled();
    expect(h.onInputText).toHaveBeenCalledTimes(2);
    expect(h.onAudio).toHaveBeenCalledWith("AAAA");
  });

  it("still fires when Live only sends a modelTurn without audio (thinking), and only once", async () => {
    const { h, ws } = connect();
    await ws.emit({ serverContent: { inputTranscription: { text: "Halo." } } });
    await ws.emit({ serverContent: { modelTurn: { parts: [{ text: "**Thinking**" }] } } });
    vi.advanceTimersByTime(STALL_MS * 3);
    expect(h.onStall).toHaveBeenCalledOnce();
  });

  it("does not fire for a late transcription chunk while the character is answering", async () => {
    const { h, ws } = connect();
    await ws.emit({ serverContent: { inputTranscription: { text: "Halo." } } });
    await ws.emit({ serverContent: { modelTurn: { parts: [{ inlineData: { data: "AAAA" } }] } } });
    await ws.emit({ serverContent: { inputTranscription: { text: " Nadia." } } });
    vi.advanceTimersByTime(STALL_MS * 2);
    expect(h.onStall).not.toHaveBeenCalled();
  });

  it("nudges only once per turn, even when more transcription arrives after the nudge", async () => {
    const { h, ws } = connect();
    await ws.emit({ serverContent: { inputTranscription: { text: "Halo." } } });
    vi.advanceTimersByTime(STALL_MS);
    await ws.emit({ serverContent: { inputTranscription: { text: " Nadia?" } } });
    vi.advanceTimersByTime(STALL_MS * 2);
    expect(h.onStall).toHaveBeenCalledOnce();
    await ws.emit({ serverContent: { outputTranscription: { text: "Halo." } } });
    await ws.emit({ serverContent: { turnComplete: true } });
    await ws.emit({ serverContent: { inputTranscription: { text: "Boleh tanya?" } } });
    vi.advanceTimersByTime(STALL_MS);
    expect(h.onStall).toHaveBeenCalledTimes(2);
  });

  it("watches the next learner turn again after the character finishes", async () => {
    const { h, ws } = connect();
    await ws.emit({ serverContent: { inputTranscription: { text: "Halo." } } });
    await ws.emit({ serverContent: { outputTranscription: { text: "Halo juga." } } });
    await ws.emit({ serverContent: { turnComplete: true } });
    await ws.emit({ serverContent: { inputTranscription: { text: "Boleh tanya?" } } });
    vi.advanceTimersByTime(STALL_MS);
    expect(h.onStall).toHaveBeenCalledOnce();
  });

  it("does not fire after the connection is closed", async () => {
    const { conn, h, ws } = connect();
    await ws.emit({ serverContent: { inputTranscription: { text: "Halo." } } });
    conn.close();
    vi.advanceTimersByTime(STALL_MS * 2);
    expect(h.onStall).not.toHaveBeenCalled();
  });
});
