import { useEffect } from "react";

function isImage(url, path) {
  const src = decodeURIComponent(path || url || "");
  const ext = src.split(".").pop().toLowerCase().split("?")[0];
  return ["jpg", "jpeg", "png", "gif", "webp"].includes(ext);
}

export default function ReceiptPreviewModal({ url, path, label, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!url) return null;

  const showAsImage = isImage(url, path);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3 shrink-0">
          <span className="text-sm font-semibold text-gray-700">{label ?? "Pratonton Resit"}</span>
          <div className="flex items-center gap-4">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium text-red-700 underline hover:text-red-900"
            >
              Buka dalam tab baharu ↗
            </a>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-gray-100">
          {showAsImage ? (
            <img
              src={url}
              alt={label ?? "Resit"}
              className="max-w-full object-contain"
              style={{ maxHeight: "75vh" }}
            />
          ) : (
            <iframe
              src={url}
              title={label ?? "Resit"}
              className="w-full border-0"
              style={{ height: "75vh" }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
