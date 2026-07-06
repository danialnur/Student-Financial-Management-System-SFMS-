import { useEffect, useState } from "react";
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

export default function ReceiptListPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const uid = currentUser?.uid;

  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(null);
  const [preview, setPreview]   = useState(null);

  useEffect(() => {
    if (!uid) return;
    getTransactionsByUser(uid)
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
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-red-900 text-left">
                    {["Tarikh", "Program", "Kategori", "Jumlah", "Fail Resit"].map((h) => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-red-100">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-50">
                  {items.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => setSelected(t)}
                      className="cursor-pointer transition-colors hover:bg-red-50"
                    >
                      <td className="px-4 py-3 text-sm text-gray-700">{t.date}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">
                          {t.programmeCode}
                        </span>
                        {t.programmeName && (
                          <p className="mt-0.5 text-xs text-gray-500">{t.programmeName}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{t.category}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-red-700">
                        RM {Number(t.amount).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {getReceiptLinks(t).length} fail
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
