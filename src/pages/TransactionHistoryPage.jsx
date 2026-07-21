import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getTransactionsByUser, removeTransaction } from "../services/transactionService";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/PageHeader";
import ReceiptPreviewModal from "../components/ReceiptPreviewModal";

const typeLabel = (t) => (t === "income" ? "Pendapatan" : "Perbelanjaan");

export default function TransactionHistoryPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [progContext, setProgContext] = useState(null);
  const [preview, setPreview] = useState(null);

  const loadTransactions = async (programmeCode) => {
    try {
      setLoading(true);
      setErrorMsg("");
      const data = await getTransactionsByUser(currentUser.uid, programmeCode);
      setTransactions(data);
    } catch (error) {
      console.error(error);
      setErrorMsg("Gagal memuatkan transaksi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser?.uid) return;
    const saved = localStorage.getItem(`sfms_prog_${currentUser.uid}`);
    let prog = null;
    try { prog = saved ? JSON.parse(saved) : null; } catch {}
    setProgContext(prog);
    loadTransactions(prog?.code ?? null);
  }, [currentUser]);

  const handleDelete = async (item) => {
    if (!window.confirm("Padam transaksi ini?")) return;
    try {
      await removeTransaction(item.id);
      await loadTransactions(progContext?.code ?? null);
    } catch (error) {
      console.error(error);
      setErrorMsg("Gagal memadam transaksi.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Sejarah Transaksi"
        action={
          <button
            onClick={() => navigate(-1)}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-red-900 hover:border-red-900 hover:text-white"
          >
            Kembali
          </button>
        }
      />

      <div className="mx-auto max-w-7xl p-6">
        {progContext && (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
            Menunjukkan transaksi untuk&nbsp;
            <span className="font-bold">{progContext.code}</span>&nbsp;—&nbsp;{progContext.name}
          </div>
        )}
        {errorMsg && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          {loading ? (
            <p className="p-6 text-sm text-gray-500">Memuatkan transaksi...</p>
          ) : transactions.length === 0 ? (
            <p className="p-6 text-sm text-gray-500">Tiada transaksi dijumpai.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-red-900 text-left">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-red-100">Program</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-red-100">Tarikh</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-red-100">Catatan</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-red-100">Kategori</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-red-100">Jenis</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-red-100">Jumlah</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-red-100">Resit</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-red-100">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-50">
                  {transactions.map((item) => (
                    <tr key={item.id} className="hover:bg-red-50 transition-colors">
                      <td className="px-4 py-3">
                        {item.programmeCode ? (
                          <div>
                            <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">
                              {item.programmeCode}
                            </span>
                            <p className="mt-0.5 text-xs text-gray-500">{item.programmeName}</p>
                          </div>
                        ) : <span className="text-xs text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{item.date}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{item.description}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{item.category}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{typeLabel(item.type)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        RM {Number(item.amount).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {item.receipts?.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {item.receipts.map((r, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => setPreview({ url: r.receiptUrl, path: r.receiptPath, label: `Resit ${i + 1}` })}
                                className="text-left font-medium text-red-700 underline hover:text-red-900"
                              >
                                Resit {i + 1}
                              </button>
                            ))}
                          </div>
                        ) : item.receiptUrl ? (
                          <button
                            type="button"
                            onClick={() => setPreview({ url: item.receiptUrl, path: item.receiptPath, label: "Resit" })}
                            className="font-medium text-red-700 underline hover:text-red-900"
                          >
                            Lihat
                          </button>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Link
                            to={`/transaksi/sunting/${item.id}`}
                            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                          >
                            Sunting
                          </Link>
                          <button
                            onClick={() => handleDelete(item)}
                            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700"
                          >
                            Padam
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {preview && (
        <ReceiptPreviewModal
          url={preview.url}
          path={preview.path}
          label={preview.label}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
