import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getProgrammesByClub } from "../services/programmeService";
import { getApprovedTransactionsForReport } from "../services/reportService";
import PageHeader from "../components/PageHeader";

const fmtRM = (v) => `RM ${Number(v || 0).toFixed(2)}`;

export default function PegawaiReportPage() {
  const navigate = useNavigate();
  const { currentUser, userProfile, selectedClub } = useAuth();

  const category  = userProfile?.category || "";

  useEffect(() => {
    if (category && !selectedClub) {
      navigate("/pegawai/pilih-kelab", { replace: true });
    }
  }, [category, selectedClub, navigate]);

  const [programmes, setProgrammes]       = useState([]);
  const [loadingProg, setLoadingProg]     = useState(false);
  const [selectedCode, setSelectedCode]   = useState("");
  const [startDate, setStartDate]         = useState("");
  const [endDate, setEndDate]             = useState("");

  const [records, setRecords]     = useState([]);
  const [loading, setLoading]     = useState(false);
  const [hasReport, setHasReport] = useState(false);
  const [errorMsg, setErrorMsg]   = useState("");

  useEffect(() => {
    if (!selectedClub) { setProgrammes([]); setSelectedCode(""); setRecords([]); setHasReport(false); return; }
    setLoadingProg(true);
    getProgrammesByClub(selectedClub)
      .then(setProgrammes)
      .catch(() => setErrorMsg("Gagal memuatkan program."))
      .finally(() => setLoadingProg(false));
    setSelectedCode(""); setRecords([]); setHasReport(false);
  }, [selectedClub]);

  const handleLoadReport = async () => {
    setErrorMsg("");
    if (!selectedClub) { setErrorMsg("Sila pilih kelab terlebih dahulu."); return; }
    setLoading(true);
    try {
      const data = await getApprovedTransactionsForReport({
        role:         "pegawai",
        uid:          currentUser.uid,
        club:         selectedClub,
        programmeCode: selectedCode || undefined,
        startDate:    startDate || undefined,
        endDate:      endDate   || undefined,
      });
      setRecords(data);
      setHasReport(true);
    } catch {
      setErrorMsg("Gagal memuatkan laporan.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedClub) handleLoadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClub]);

  const totalIncome  = records.filter(r => r.type === "income").reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalExpense = records.filter(r => r.type === "expense").reduce((s, r) => s + Number(r.amount || 0), 0);
  const balance      = totalIncome - totalExpense;

  const inputClass = "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100";

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Penyata Kewangan Kelab"
        subtitle={selectedClub ? `Kelab: ${selectedClub}` : (category ? `Kategori: ${category}` : "")}
        action={
          <button
            onClick={() => navigate(-1)}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-red-900 hover:border-red-900 hover:text-white"
          >
            Kembali
          </button>
        }
      />

      <div className="mx-auto max-w-7xl space-y-6 p-6">

        {!category ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-700">
            Akaun anda belum ditetapkan kategori kelab. Sila hubungi pentadbir.
          </div>
        ) : (
          <>
            {/* Filters */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-red-700">Program &amp; Tarikh</h2>
                <Link to="/pegawai/pilih-kelab" className="text-xs font-medium text-red-800 hover:underline">
                  Tukar Kelab
                </Link>
              </div>
              <div className="mb-4 rounded-xl border border-gray-100 bg-gray-50 px-4 py-2.5 text-sm text-gray-700">
                <span className="font-semibold">Kelab Diselia: </span>{selectedClub}
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-600">Program</label>
                  <select
                    value={selectedCode}
                    onChange={e => setSelectedCode(e.target.value)}
                    disabled={!selectedClub || loadingProg}
                    className={inputClass}
                  >
                    <option value="">Semua Program</option>
                    {programmes.map(p => (
                      <option key={p.id} value={p.code}>{p.code} — {p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-600">Dari Tarikh</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputClass} />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-600">Hingga Tarikh</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputClass} />
                </div>
              </div>

              <div className="mt-4">
                <button
                  onClick={handleLoadReport}
                  disabled={loading || !selectedClub}
                  className="rounded-xl bg-red-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-800 disabled:opacity-60"
                >
                  {loading ? "Memuatkan..." : "Jana Penyata"}
                </button>
              </div>

              {errorMsg && (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMsg}</div>
              )}
            </div>

            {/* Summary cards */}
            {hasReport && (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  {[
                    { label: "Jumlah Pendapatan", value: fmtRM(totalIncome),  color: "text-green-600" },
                    { label: "Jumlah Perbelanjaan", value: fmtRM(totalExpense), color: "text-red-600"   },
                    { label: "Baki",               value: fmtRM(balance),      color: balance >= 0 ? "text-gray-900" : "text-red-700" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                      <p className={`text-xs font-semibold uppercase tracking-wider ${color}`}>{label}</p>
                      <p className={`mt-2 text-2xl font-bold ${color}`}>{value}</p>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end">
                  <Link
                    to="/transaksi/sunting"
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-red-900 hover:border-red-900 hover:text-white"
                  >
                    Sunting Transaksi
                  </Link>
                </div>

                {/* Transactions table */}
                <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                  <div className="border-b border-red-100 px-6 py-4 flex items-center justify-between">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-red-700">
                      Senarai Transaksi Diluluskan
                    </h2>
                    <span className="text-xs text-gray-500">{records.length} rekod</span>
                  </div>

                  {records.length === 0 ? (
                    <p className="p-6 text-sm text-gray-500">Tiada transaksi diluluskan untuk pilihan ini.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead>
                          <tr className="bg-red-900 text-left">
                            {["Tarikh", "Penerangan", "Jenis", "Kategori", "Jumlah", "Program"].map(h => (
                              <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-red-100">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {records.map(rec => (
                            <tr key={rec.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 text-sm text-gray-600">{rec.date || "—"}</td>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">{rec.description || "—"}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${rec.type === "income" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                  {rec.type === "income" ? "Pendapatan" : "Perbelanjaan"}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-500">{rec.category || "—"}</td>
                              <td className={`px-4 py-3 text-sm font-semibold ${rec.type === "income" ? "text-green-700" : "text-red-700"}`}>
                                {fmtRM(rec.amount)}
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-500">{rec.programmeCode || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
