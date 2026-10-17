import { describe, expect, it } from "vitest";
import {
  STATUS_LABEL,
  calculateRemainingQuota,
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

  it("renders rows with scenario title and mapped status label", () => {
    const rows: HistoryRow[] = [
      {
        id: "sess-1",
        status: "grading",
        started_at: "2026-10-17T10:00:00.000Z",
        v: { title: "Laundry Bu Ratna", client_name: "Bu Ratna" },
      },
      {
        id: "sess-2",
        status: "grading_failed",
        started_at: "2026-10-17T09:00:00.000Z",
        v: { title: "Distribusi Pak Hendra", client_name: "Pak Hendra" },
      },
    ];

    const el = SessionHistory({ rows });
    expect(el.type).toBe("ol");
    expect(el.props.children).toHaveLength(2);
  });
});
