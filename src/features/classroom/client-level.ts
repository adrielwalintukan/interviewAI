/**
 * Issue #49: how open the client is in an assignment's sessions, chosen when the assignment is created.
 * Library practice and teacher previews have no assignment and are always "normal".
 */
export const CLIENT_LEVELS = ["mudah", "normal", "sulit"] as const;
export type ClientLevel = (typeof CLIENT_LEVELS)[number];

export const CLIENT_LEVEL_NAME: Record<ClientLevel, string> = { mudah: "Mudah", normal: "Normal", sulit: "Sulit" };

/** Assignment form (teacher). */
export const CLIENT_LEVEL_OPTION: Record<ClientLevel, string> = {
  mudah: "Mudah: klien terbuka, banyak bercerita sendiri",
  normal: "Normal: klien menjawab yang ditanya",
  sulit: "Sulit: klien tertutup, perlu pertanyaan lanjutan",
};

/** Lobby (learner): "Klien: …". */
export const CLIENT_LEVEL_LOBBY: Record<ClientLevel, string> = { mudah: "terbuka", normal: "menjawab yang ditanya", sulit: "tertutup" };
