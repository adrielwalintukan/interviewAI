import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/features/auth/dal";
import { loadAssignmentResults } from "@/features/grading/assignment-results";
import { scoresCsv, scoresFileName } from "@/features/grading/class-dashboard";

/** US-G-09: final scores of one assignment as CSV, for the class owner or an admin only. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/kelas/[id]/tugas/[tugasId]/nilai-csv">) {
  const user = await getCurrentUser();
  const { id, tugasId } = await ctx.params;
  // Same 404 for "no such assignment" and "not yours", so ids can't be probed.
  const results = user && user.status === "active" && !user.mustChangePassword ? await loadAssignmentResults(user, id, tugasId) : null;
  if (!results) return new Response("Tidak ditemukan", { status: 404 });
  if (results.failed) return new Response("Nilai gagal dimuat. Coba lagi.", { status: 500 });

  return new Response(scoresCsv(results.learners, results.assignment.client_level), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${scoresFileName(results.assignment.v?.title ?? "", new Date())}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
