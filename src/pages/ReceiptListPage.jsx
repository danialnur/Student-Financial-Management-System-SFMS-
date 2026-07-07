import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getTransactionsByUser } from "../services/transactionService";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/PageHeader";
import ReceiptPreviewModal from "../components/ReceiptPreviewModal";

function fmtDateTime(ts) {
  if (!ts?.toDate) return "—";
  return ts.toDate().toLocaleString("ms-MY", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function getReceiptLinks(t) {
  if (t.receipts?.length > 0) return t.receipts;
  if (t.receiptUrl) return [{ receiptUrl: t.receiptUrl }];
  return [];
}

const XIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// Clickable sort arrows shown in table header
function SortArrows({ colKey, sortState, onSort }) {
  const active = sortState.col === colKey;
  const dir    = active ? sortState.dir : null;
  return (
    <button
      type="button"
      onClick={() => onSort(colKey)}
      className="ml-1.5 inline-flex flex-col items-center gap-0.5 align-middle"
      title="Klik untuk susun"
    >
      <svg viewBox="0 0 8 5" className={`h-2 w-2 ${dir === "asc" ? "fill-white" : "fill-red-400"}`}>
        <path d="M4 0L8 5H0z" />
      </svg>
      <svg viewBox="0 0 8 5" className={`h-2 w-2 ${dir === "desc" ? "fill-white" : "fill-red-400"}`}>
        <path d="M4 5L0 0H8z" />
      </svg>
    </button>
  );
}

export default function ReceiptListPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const uid = currentUser?.uid;

  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(null);
  const [preview, setPreview]   = useState(null);

  // Search + date range + sort
  const [search, setSearch]       = useState("");
  const [dateFrom, setDateFrom]   = useState("");
  const [dateTo, setDateTo]       = useState("");
  const [sortState, setSortState] = useState({ col: null, dir: null });

  useEffect(() => {
    if (!uid) return;
    let programmeCode = null;
    try { programmeCode = JSON.parse(localStorage.getItem(`sfms_prog_${uid}`) || "null")?.code ?? null; } catch {}
    getTransactionsByUser(uid, programmeCode)
      .then((all) => {
        setItems(
          all.filter(
            (t) => t.type === "expense" && (t.receipts?.length > 0 || t.receiptUrl)
          )
        );
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [uid]);

  // Sort cycle: null → asc → desc → null
  const handleSort = (col) => {
    setSortState(prev => {
      if (prev.col !== col)   return { col, dir: "asc" };
      if (prev.dir === "asc") return { col, dir: "desc" };
      return { col: null, dir: null };
    });
  };

  const displayedItems = useMemo(() => {
    const q    = search.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom) : null;
    const to   = dateTo   ? new Date(dateTo)   : null;

    const filtered = items.filter((t) => {
      if (q) {
        const name = (t.programmeName || "").toLowerCase();
        const cat  = (t.category || "").toLowerCase();
        if (!name.includes(q) && !cat.includes(q)) return false;
      }
      if (from || to) {
        const d = t.date ? new Date(t.date) : null;
        if (!d) return false;
        if (from && d < from) return false;
        if (to   && d > to)   return false;
      }
      return true;
    });

    const { col, dir } = sortState;
    if (!col) return filtered;

    return [...filtered].sort((a, b) => {
      if (col === "tarikh") {
        const cmp = (a.date || "").localeCompare(b.date || "");
        return dir === "asc" ? cmp : -cmp;
      }
      if (col === "kategori") {
        const cmp = (a.category || "").localeCompare(b.category || "");
        return dir === "asc" ? cmp : -cmp;
      }
      if (col === "jumlah") {
        const cmp = Number(a.amount || 0) - Number(b.amount || 0);
        return dir === "asc" ? cmp : -cmp;
      }
      if (col === "fail") {
        const cmp = getReceiptLinks(a).length - getReceiptLinks(b).length;
        return dir === "asc" ? cmp : -cmp;
      }
      return 0;
    });
  }, [items, search, dateFrom, dateTo, sortState]);

  const hasFilters   = search || dateFrom || dateTo;
  const clearFilters = () => { setSearch(""); setDateFrom(""); setDateTo(""); setSortState({ col: null, dir: null }); };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Senarai Resit"
        action={
          <button
            onClick={() => navigate(-1)}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-red-900 hover:border-red-900 hover:text-white"
          >
            Kembali
          </button>
        }
      />

      <div className="mx-auto max-w-5xl p-6">
        {loading ? (
          <p className="text-sm text-gray-400">Memuatkan resit...</p>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500 shadow-sm">
            Tiada resit perbelanjaan dijumpai.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-red-100 px-6 py-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-red-800">
                Semua Resit Perbelanjaan ({items.length})
              </p>
            </div>

            {/* Search + date range */}
            <div className="border-b border-gray-100 px-6 py-4 space-y-3">
              <div className="relative">
                <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" /></svg>
                <input
                  type="text"
                  placeholder="Cari nama program atau kategori..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-9 text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-100"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><XIcon /></button>
                )}
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Tarikh Dari</label>
                  <input
                    type="date"
                    value={dateFrom}
                    max={dateTo || undefined}
                    onChange={e => setDateFrom(e.target.value)}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Hingga</label>
                  <input
                    type="date"
                    value={dateTo}
                    min={dateFrom || undefined}
                    onChange={e => setDateTo(e.target.value)}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-100"
                  />
                </div>
                {(dateFrom || dateTo) && (
                  <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-500 hover:text-red-700 hover:border-red-200 transition">
                    Kosongkan Tarikh
                  </button>
                )}
              </div>

              {hasFilters && (
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>
                    Menunjukkan <strong className="text-gray-800">{displayedItems.length}</strong> daripada{" "}
                    <strong className="text-gray-800">{items.length}</strong> resit
                  </span>
                  <button onClick={clearFilters} className="font-medium text-red-700 hover:underline">
                    Padam semua
                  </button>
                </div>
              )}
            </div>

            {displayedItems.length === 0 ? (
              <p className="p-6 text-sm text-gray-500">Tiada resit yang sepadan dengan carian / julat tarikh.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-red-900 text-left">
                      {[
                        { label: "Tarikh",     col: "tarikh" },
                        { label: "Kategori",   col: "kategori" },
                        { label: "Jumlah",     col: "jumlah" },
                        { label: "Fail Resit", col: "fail" },
                      ].map(({ label, col }) => (
                        <th key={col} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-red-100">
                          <span className="inline-flex items-center">
                            {label}
                            <SortArrows colKey={col} sortState={sortState} onSort={handleSort} />
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-50">
                    {displayedItems.map((t) => (
                      <tr
                        key={t.id}
                        onClick={() => setSelected(t)}
                        className="cursor-pointer transition-colors hover:bg-red-50"
                      >
                        <td className="px-4 py-3 text-sm text-gray-700">{t.date}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{t.category}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-red-700">
                          RM {Number(t.amount).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {getReceiptLinks(t).length}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {preview && (
        <ReceiptPreviewModal
          url={preview.url}
          path={preview.path}
          label={preview.label}
          onClose={() => setPreview(null)}
        />
      )}

      {/* ── Detail modal ── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <button
              onClick={() => setSelected(null)}
              className="absolute right-4 top-4 rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h3 className="mb-4 text-base font-bold text-gray-900">Maklumat Resit</h3>

            <div className="space-y-3">
              {[
                { label: "Program",          value: `${selected.programmeCode} — ${selected.programmeName}` },
                { label: "Jenis",            value: "Perbelanjaan" },
                { label: "Kategori",         value: selected.category },
                { label: "Jumlah",           value: `RM ${Number(selected.amount).toFixed(2)}` },
                { label: "Tarikh Transaksi", value: selected.date },
                { label: "Tarikh Ditambah",  value: fmtDateTime(selected.createdAt) },
                ...(selected.description ? [{ label: "Catatan", value: selected.description }] : []),
              ].map(({ label, value }) => (
                <div key={label} className="flex gap-3">
                  <span className="w-36 shrink-0 text-xs font-medium text-gray-500">{label}</span>
                  <span className="text-sm text-gray-800">{value}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 border-t border-gray-100 pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Fail Resit
              </p>
              <div className="space-y-2">
                {getReceiptLinks(selected).map((r, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setPreview({ url: r.receiptUrl, path: r.receiptPath, label: `Resit ${i + 1}` })}
                    className="flex w-full items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                  >
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    Resit {i + 1}
                    <svg className="ml-auto h-3.5 w-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
