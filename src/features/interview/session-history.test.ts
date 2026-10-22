import { describe, expect, it } from "vitest";
import {
  STATUS_LABEL,
  calculateRemainingQuota,
  getSessionScore,
  MAX_DAILY_LIBRARY_SESSIONS,
  SessionHistory,
  type HistoryRow,
} from "./session-history";

describe("calculateRemainingQuota", () => {
  it("calculates remaining daily library quota accurately", () => {
    expect(MAX_DAILY_LIBRARY_SESSIONS).toBe(3);
    expect(calculateRemainingQuota(0)).toBe(3);
    expect(calculateRemainingQuota(1)).toBe(2);
    expect(calculateRemainingQuota(2)).toBe(1);
    expect(calculateRemainingQuota(3)).toBe(0);
  });

  it("clamps quota to 0 if sessions exceed daily quota", () => {
    expect(calculateRemainingQuota(4)).toBe(0);
    expect(calculateRemainingQuota(10)).toBe(0);
  });
});

describe("getSessionScore", () => {
  it("returns null for non-graded sessions", () => {
    expect(getSessionScore({ id: "1", status: "active", started_at: "", v: null })).toBeNull();
    expect(getSessionScore({ id: "2", status: "grading", started_at: "", v: null })).toBeNull();
    expect(getSessionScore({ id: "3", status: "grading_failed", started_at: "", v: null })).toBeNull();
    expect(getSessionScore({ id: "4", status: "ended", started_at: "", v: null })).toBeNull();
  });

  it("returns final_score or ai_score for graded sessions", () => {
    expect(
      getSessionScore({
        id: "5",
        status: "graded",
        started_at: "",
        v: null,
        evaluation: { final_score: 92, ai_score: 85 },
      }),
    ).toBe(92);

    expect(
      getSessionScore({
        id: "6",
        status: "graded",
        started_at: "",
        v: null,
        evaluation: { final_score: null, ai_score: 78 },
      }),
    ).toBe(78);
  });

  it("handles array evaluations from PostgREST joins", () => {
    expect(
      getSessionScore({
        id: "7",
        status: "graded",
        started_at: "",
        v: null,
        evaluation: [{ final_score: 88, ai_score: 88 }],
      }),
    ).toBe(88);
  });
});

describe("STATUS_LABEL", () => {
  it("maps grading and failed states accurately without ambiguity", () => {
    expect(STATUS_LABEL.grading).toBe("Penilaian diproses");
    expect(STATUS_LABEL.grading_failed).toBe("Penilaian gagal");
    expect(STATUS_LABEL.active).toBe("Berjalan");
    expect(STATUS_LABEL.ended).toBe("Selesai");
    expect(STATUS_LABEL.graded).toBe("Sudah dinilai");
  });
});

describe("SessionHistory", () => {
  it("renders default empty state when rows is empty", () => {
    const el = SessionHistory({ rows: [] });
    expect(el.props.children).toBe("Belum ada wawancara. Transkripmu akan tersimpan di sini.");
  });

  it("renders custom empty state when provided", () => {
    const customEmpty = "Belum ada riwayat latihan. Pilih salah satu skenario di atas untuk mulai berlatih.";
    const el = SessionHistory({ rows: [], empty: customEmpty });
    expect(el.props.children).toBe(customEmpty);
  });

  it("renders rows with scenario title, status label, score, and transcript link", () => {
    const rows: HistoryRow[] = [
      {
        id: "sess-1",
        status: "grading",
        started_at: "2026-10-17T10:00:00.000Z",
        v: { title: "Laundry Bu Ratna", client_name: "Bu Ratna" },
      },
      {
        id: "sess-2",
        status: "graded",
        started_at: "2026-10-17T09:00:00.000Z",
        v: { title: "Distribusi Pak Hendra", client_name: "Pak Hendra" },
        evaluation: { final_score: 88, ai_score: 88 },
      },
    ];

    const el = SessionHistory({ rows });
    expect(el.type).toBe("ol");
    expect(el.props.children).toHaveLength(2);

    // Verifikasi item pertama (grading in progress)
    const item1 = el.props.children[0];
    expect(item1.key).toBe("sess-1");
    const [info1, link1] = item1.props.children;
    const [title1, meta1] = info1.props.children;
    expect(title1.props.children).toBe("Laundry Bu Ratna");
    expect(meta1.props.children[1].props.children).toBe("Penilaian diproses");
    expect(link1.props.href).toBe("/sesi/sess-1/selesai");

    // Verifikasi item kedua (graded dengan score)
    const item2 = el.props.children[1];
    expect(item2.key).toBe("sess-2");
    const [info2, link2] = item2.props.children;
    const [title2, meta2] = info2.props.children;
    expect(title2.props.children).toBe("Distribusi Pak Hendra");
    expect(meta2.props.children[1].props.children).toBe("Sudah dinilai");
    // Verifikasi score element
    const scoreEl = meta2.props.children[2];
    expect(scoreEl).not.toBeNull();
    expect(scoreEl.props.children[0]).toBe("Nilai ");
    expect(scoreEl.props.children[1].props.children).toBe(88);
    expect(link2.props.href).toBe("/sesi/sess-2/selesai");
  });
});
