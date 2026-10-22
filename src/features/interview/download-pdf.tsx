"use client";

/** Browser print dialog → "Simpan sebagai PDF"; the title becomes the suggested file name. */
export function DownloadPdfButton({ fileName }: { fileName: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        const prev = document.title;
        document.title = fileName;
        window.print();
        document.title = prev;
      }}
      className="inline-flex min-h-11 items-center rounded-sm border border-rule px-5 hover:border-ink"
    >
      Unduh PDF
    </button>
  );
}
