// Gemini Live over WebSocket with an ephemeral token. The token already carries the full setup
// (persona, voice, transcription); the setup we send is ignored server-side (architecture §3.1).

const ENDPOINT =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained";

/**
 * Normally the learner's transcription arrives together with Live's end-of-turn and the reply starts
 * within ~1 s. Transcription with no reply means Live's VAD never closed the turn (2026-10-18 session:
 * ~2 min of transcribed speech, no answer), so the client nudges after this long.
 */
export const STALL_MS = 6_000;

export type LiveHandlers = {
  onReady: () => void;
  onAudio: (b64: string) => void;
  onInputText: (text: string) => void;
  onOutputText: (text: string) => void;
  onTurnComplete: () => void;
  onInterrupted: () => void;
  /** The learner's speech was transcribed but the character stayed silent for STALL_MS. */
  onStall: () => void;
  onClose: (info: { code: number; reason: string; ready: boolean }) => void;
};

type ServerMessage = {
  setupComplete?: unknown;
  serverContent?: {
    // modelTurn text parts are deliberately ignored: native-audio models put "thinking" there,
    // which can reveal hidden facts. Only transcriptions reach the UI (spike 2026-10-14).
    modelTurn?: { parts?: { inlineData?: { data: string; mimeType?: string } }[] };
    inputTranscription?: { text?: string };
    outputTranscription?: { text?: string };
    turnComplete?: boolean;
    interrupted?: boolean;
  };
  goAway?: unknown;
};

export class LiveConnection {
  private ws: WebSocket;
  private ready = false;
  private stall: ReturnType<typeof setTimeout> | undefined;
  private replying = false;

  constructor(token: string, model: string, private h: LiveHandlers) {
    this.ws = new WebSocket(`${ENDPOINT}?access_token=${encodeURIComponent(token)}`);
    this.ws.onopen = () => this.ws.send(JSON.stringify({ setup: { model } }));
    this.ws.onmessage = async (ev) => {
      const raw = typeof ev.data === "string" ? ev.data : await (ev.data as Blob).text();
      let msg: ServerMessage;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }
      if (msg.setupComplete !== undefined) {
        this.ready = true;
        h.onReady();
      }
      const sc = msg.serverContent;
      if (!sc) return;
      // Only output the learner hears or reads counts as a reply; a modelTurn with just "thinking" does not.
      const output = Boolean(sc.modelTurn?.parts?.some((p) => p.inlineData?.data) || sc.outputTranscription?.text);
      const ended = Boolean(sc.turnComplete || sc.interrupted);
      if (output) this.replying = true;
      if (output || ended || sc.inputTranscription?.text) clearTimeout(this.stall);
      // A late transcription chunk while the character is answering must not re-send the question.
      if (sc.inputTranscription?.text && !this.replying && !ended) this.stall = setTimeout(h.onStall, STALL_MS);
      if (ended) this.replying = false;
      for (const p of sc.modelTurn?.parts ?? []) if (p.inlineData?.data) h.onAudio(p.inlineData.data);
      if (sc.inputTranscription?.text) h.onInputText(sc.inputTranscription.text);
      if (sc.outputTranscription?.text) h.onOutputText(sc.outputTranscription.text);
      if (sc.interrupted) h.onInterrupted();
      if (sc.turnComplete) h.onTurnComplete();
    };
    this.ws.onclose = (ev) => {
      clearTimeout(this.stall);
      h.onClose({ code: ev.code, reason: ev.reason, ready: this.ready });
    };
  }

  get isOpen() {
    return this.ws.readyState === WebSocket.OPEN && this.ready;
  }

  sendAudio(b64: string) {
    if (this.isOpen) this.ws.send(JSON.stringify({ realtimeInput: { audio: { data: b64, mimeType: "audio/pcm;rate=16000" } } }));
  }

  sendText(text: string) {
    if (this.isOpen) this.ws.send(JSON.stringify({ clientContent: { turns: [{ role: "user", parts: [{ text }] }], turnComplete: true } }));
  }

  close() {
    clearTimeout(this.stall);
    this.ws.onclose = null;
    this.ws.close();
  }
}
