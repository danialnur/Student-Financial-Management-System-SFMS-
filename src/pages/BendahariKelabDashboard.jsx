import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getBendahariKelabSummary } from "../services/dashboardService";
import { getPendingBorangByClub } from "../services/formService";
import { getAccessRequestsByClub } from "../services/programmeAccessService";
import { getApprovedTransactionsForReport } from "../services/reportService";
import PageHeader from "../components/PageHeader";

const fmtRM = (v) => `RM ${Number(v || 0).toFixed(2)}`;
const typeLabel = (t) => (t === "income" ? "Pendapatan" : "Perbelanjaan");
const TXN_PAGE_SIZE = 10;

export default function BendahariKelabDashboard() {
  const navigate = useNavigate();
  const { currentUser, userProfile, logout } = useAuth();

  const club = userProfile?.club || "";

  const [summary, setSummary]         = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [summaryError, setSummaryError] = useState("");
  const [pendingForms, setPendingForms]         = useState(0);
  const [loadingForms, setLoadingForms]         = useState(true);
  const [pendingAccessCount, setPendingAccessCount] = useState(0);

  const [txnModal, setTxnModal]     = useState(null); // "income" | "expense" | "all"
  const [txnList, setTxnList]       = useState([]);
  const [txnLoading, setTxnLoading] = useState(false);
  const [txnSort, setTxnSort]       = useState({ col: null, dir: null });
  const [txnPage, setTxnPage]       = useState(1);

  // Loads three independent counters for this club in parallel: financial
  // summary across all its programmes, pending borang count, and pending
  // programme-access request count — each drives its own dashboard tile.
  useEffect(() => {
    if (!club) return;
    setLoadingSummary(true);
    setSummaryError("");
    getBendahariKelabSummary(club)
      .then(setSummary)
      .catch((err) => {
        console.error(err);
        setSummaryError(err?.code ? `${err.code}: ${err.message}` : (err?.message || "Ralat tidak diketahui"));
      })
      .finally(() => setLoadingSummary(false));

    setLoadingForms(true);
    getPendingBorangByClub(club)
      .then((list) => setPendingForms(list.length))
      .catch(console.error)
      .finally(() => setLoadingForms(false));

    getAccessRequestsByClub(club)
      .then((list) => setPendingAccessCount(list.filter(r => r.status === "pending").length))
      .catch(console.error);
  }, [club]);

  const handleLogout = async () => { await logout(); navigate("/login"); };

  // Fetches every approved transaction for the club, then filters client-side
  // by type ("income"/"expense") or shows everything for "all".
  const openTxnModal = async (type) => {
    setTxnModal(type);
    setTxnList([]);
    setTxnSort({ col: null, dir: null });
    setTxnPage(1);
    setTxnLoading(true);
    try {
      const all = await getApprovedTransactionsForReport({ role: "bendahari_kelab", club });
      setTxnList(type === "all" ? all : all.filter(t => t.type === type));
    } catch {
      setTxnList([]);
    } finally {
      setTxnLoading(false);
    }
  };

  const handleTxnSort = (col) => {
    setTxnSort(prev => {
      if (prev.col !== col) return { col, dir: "asc" };
      if (prev.dir === "asc") return { col, dir: "desc" };
      return { col: null, dir: null };
    });
    setTxnPage(1);
  };

  const sortedTxnList = useMemo(() => {
    const { col, dir } = txnSort;
    if (!col) return txnList;
    return [...txnList].sort((a, b) => {
      if (col === "programme") {
        const va = a.programmeCode || "", vb = b.programmeCode || "";
        return dir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      if (col === "date") {
        const va = a.date || "", vb = b.date || "";
        return dir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      if (col === "catatan") {
        const va = a.description || "", vb = b.description || "";
        if (!va && !vb) return 0;
        if (!va) return dir === "asc" ? 1 : -1;
        if (!vb) return dir === "asc" ? -1 : 1;
        return dir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      if (col === "kategori") {
        const va = a.category || "", vb = b.category || "";
        return dir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      if (col === "jenis") {
        const va = a.type || "", vb = b.type || "";
        return dir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      if (col === "jumlah") {
        const va = Number(a.amount || 0), vb = Number(b.amount || 0);
        return dir === "asc" ? va - vb : vb - va;
      }
      return 0;
    });
  }, [txnList, txnSort]);

  const txnTotalPages = Math.max(1, Math.ceil(sortedTxnList.length / TXN_PAGE_SIZE));
  const pagedTxnList = sortedTxnList.slice((txnPage - 1) * TXN_PAGE_SIZE, txnPage * TXN_PAGE_SIZE);

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title={`Selamat Datang, ${userProfile?.username ?? currentUser?.email}!`}
        action={
          <button onClick={handleLogout} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-red-900 hover:border-red-900 hover:text-white">
            Log Keluar
          </button>
        }
      />

      <div className="mx-auto max-w-7xl space-y-6 p-6">

        {/* Club info banner */}
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span className="font-semibold">Kelab: </span>{club || <span className="italic text-red-400">Belum ditetapkan (hubungi admin)</span>}
          <span className="mx-3 text-red-300">·</span>
          <span className="text-xs text-red-600">{currentUser?.email}</span>
        </div>

        {!club ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-700">
            Akaun anda belum ditetapkan kelab. Sila hubungi pentadbir untuk menetapkan kelab anda.
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-red-800">
              Rumusan Kewangan
            </p>
            <p className="mb-3 text-xs text-gray-400">
              Klik pada kad di bawah untuk melihat butiran merentasi semua program.
            </p>
            {summaryError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                Gagal memuatkan ringkasan kewangan: {summaryError}
              </div>
            )}
            {loadingSummary ? (
              <p className="text-sm text-gray-400">Memuatkan ringkasan...</p>
            ) : summary && (() => {
              const isRugi = summary.balance < 0;
              return (
                <div className="mb-8 grid gap-4 md:grid-cols-3">
                  <button
                    onClick={() => openTxnModal("income")}
                    className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm text-left transition hover:border-green-400 hover:shadow-md"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wider text-green-600">Jumlah Pendapatan</p>
                    <h2 className="mt-2 text-2xl font-bold text-gray-900">{fmtRM(summary.totalIncome)}</h2>
                  </button>
                  <button
                    onClick={() => openTxnModal("expense")}
                    className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm text-left transition hover:border-red-400 hover:shadow-md"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wider text-red-600">Jumlah Perbelanjaan</p>
                    <h2 className="mt-2 text-2xl font-bold text-gray-900">{fmtRM(summary.totalExpense)}</h2>
                  </button>
                  <button
                    onClick={() => openTxnModal("all")}
                    className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-sm text-left transition hover:shadow-md ${isRugi ? "hover:border-red-400" : "hover:border-blue-400"}`}
                  >
                    <p className={`text-xs font-semibold uppercase tracking-wider ${isRugi ? "text-red-600" : "text-blue-600"}`}>
                      {isRugi ? "Jumlah Rugi Keseluruhan" : "Jumlah Untung Keseluruhan"}
                    </p>
                    <h2 className={`mt-2 text-2xl font-bold ${isRugi ? "text-red-600" : "text-gray-900"}`}>
                      {fmtRM(summary.balance)}
                    </h2>
                  </button>
                </div>
              );
            })()}

            {/* Quick actions */}
            <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-5">
              <Link
                to="/bendahari-kelab/approvals"
                className="flex items-center justify-between rounded-2xl border border-amber-200 bg-white p-5 shadow-sm transition hover:bg-amber-50"
              >
                <div>
                  <p className="text-sm font-bold text-gray-900">Kelulusan Borang</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {loadingForms ? "Memuatkan..." : `${pendingForms} borang menunggu`}
                  </p>
                </div>
                <span className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${pendingForms > 0 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-400"}`}>
                  {loadingForms ? "…" : pendingForms}
                </span>
              </Link>

              <Link
                to="/bendahari-kelab/forms"
                className="flex items-center justify-between rounded-2xl border border-blue-200 bg-white p-5 shadow-sm transition hover:bg-blue-50"
              >
                <div>
                  <p className="text-sm font-bold text-gray-900">Borang Kewangan</p>
                  <p className="mt-0.5 text-xs text-gray-500">Lihat semua borang mengikut program</p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-lg font-bold">≡</span>
              </Link>

              <Link
                to="/bendahari-kelab/penyata-kewangan"
                className="flex items-center justify-between rounded-2xl border border-green-200 bg-white p-5 shadow-sm transition hover:bg-green-50"
              >
                <div>
                  <p className="text-sm font-bold text-gray-900">Penyata Kewangan</p>
                  <p className="mt-0.5 text-xs text-gray-500">Transaksi diluluskan mengikut program</p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-700 text-lg font-bold">↓</span>
              </Link>

              <Link
                to="/bendahari-kelab/programmes"
                className="flex items-center justify-between rounded-2xl border border-red-200 bg-white p-5 shadow-sm transition hover:bg-red-50"
              >
                <div>
                  <p className="text-sm font-bold text-gray-900">Urus Program</p>
                  <p className="mt-0.5 text-xs text-gray-500">Tambah atau padam program kelab</p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-700 text-lg font-bold">+</span>
              </Link>

              <Link
                to="/bendahari-kelab/access-requests"
                className="flex items-center justify-between rounded-2xl border border-purple-200 bg-white p-5 shadow-sm transition hover:bg-purple-50"
              >
                <div>
                  <p className="text-sm font-bold text-gray-900">Permohonan Akses</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {pendingAccessCount > 0 ? `${pendingAccessCount} permohonan menunggu` : "Urus akses bendahari"}
                  </p>
                </div>
                <span className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${pendingAccessCount > 0 ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-400"}`}>
                  {pendingAccessCount}
                </span>
              </Link>

              <Link
                to="/transaksi/sunting"
                className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:bg-gray-50"
              >
                <div>
                  <p className="text-sm font-bold text-gray-900">Sunting Transaksi</p>
                  <p className="mt-0.5 text-xs text-gray-500">Cari dan sunting transaksi sedia ada</p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600 text-lg font-bold">✎</span>
              </Link>
            </div>

            {/* Per-programme breakdown */}
            {!loadingSummary && summary && summary.programmes.length > 0 && (
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-red-100 px-6 py-4">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-red-700">
                    Pergerakan Wang Mengikut Program
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-red-900 text-left">
                        {["Kod", "Nama Program", "Pendapatan", "Perbelanjaan", "Untung / Rugi"].map((h) => (
                          <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-red-100">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-red-50">
                      {summary.programmes.map((prog) => (
                        <tr key={prog.id} className="hover:bg-red-50 transition-colors">
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">{prog.code}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">{prog.name}</td>
                          <td className="px-4 py-3 text-sm font-medium text-green-700">{fmtRM(prog.totalIncome)}</td>
                          <td className="px-4 py-3 text-sm font-medium text-red-700">{fmtRM(prog.totalExpense)}</td>
                          <td className={`px-4 py-3 text-sm font-bold ${prog.balance < 0 ? "text-red-600" : "text-gray-900"}`}>
                            <span className="mr-1 text-xs font-semibold">{prog.balance < 0 ? "Rugi" : "Untung"}</span>
                            {fmtRM(prog.balance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {summary.programmes.length === 0 && (
                  <p className="p-6 text-sm text-gray-500">Tiada program dijumpai untuk kelab ini.</p>
                )}
              </div>
            )}

            {!loadingSummary && summary && summary.programmes.length === 0 && (
              <p className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
                Tiada program berdaftar untuk kelab <span className="font-semibold">{club}</span> lagi.
              </p>
            )}
          </>
        )}
      </div>

      {/* ── Transaction detail modal ── */}
      {txnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-xl">

            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  {txnModal === "income"  && "Senarai Pendapatan"}
                  {txnModal === "expense" && "Senarai Perbelanjaan"}
                  {txnModal === "all"     && "Semua Transaksi"}
                </h3>
                <p className="mt-0.5 text-xs text-gray-500">Kelab: {club} — merentasi semua program</p>
              </div>
              <button
                onClick={() => setTxnModal(null)}
                className="rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {txnLoading ? (
                <p className="p-6 text-sm text-gray-500">Memuatkan...</p>
              ) : txnList.length === 0 ? (
                <p className="p-6 text-sm text-gray-500">Tiada rekod dijumpai.</p>
              ) : (
                <table className="min-w-full">
                  <thead className="sticky top-0 bg-red-900">
                    <tr>
                      {[
                        { col: "programme", label: "Program",  align: "left"  },
                        { col: "date",      label: "Tarikh",   align: "left"  },
                        { col: "catatan",   label: "Catatan",  align: "left"  },
                        { col: "kategori",  label: "Kategori", align: "left"  },
                      ].map(({ col, label, align }) => (
                        <th
                          key={col}
                          onClick={() => handleTxnSort(col)}
                          className={`cursor-pointer select-none px-4 py-3 text-${align} text-xs font-semibold uppercase tracking-wider text-red-100 hover:bg-red-800`}
                        >
                          <span className="inline-flex items-center gap-1">
                            {label}
                            <span className="inline-flex flex-col leading-none">
                              <svg width="8" height="5" viewBox="0 0 8 5" className="mb-0.5">
                                <polygon points="4,0 8,5 0,5" fill={txnSort.col === col && txnSort.dir === "asc" ? "white" : "rgba(255,255,255,0.3)"} />
                              </svg>
                              <svg width="8" height="5" viewBox="0 0 8 5">
                                <polygon points="4,5 8,0 0,0" fill={txnSort.col === col && txnSort.dir === "desc" ? "white" : "rgba(255,255,255,0.3)"} />
                              </svg>
                            </span>
                          </span>
                        </th>
                      ))}
                      {txnModal === "all" && (
                        <th
                          onClick={() => handleTxnSort("jenis")}
                          className="cursor-pointer select-none px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-red-100 hover:bg-red-800"
                        >
                          <span className="inline-flex items-center gap-1">
                            Jenis
                            <span className="inline-flex flex-col leading-none">
                              <svg width="8" height="5" viewBox="0 0 8 5" className="mb-0.5">
                                <polygon points="4,0 8,5 0,5" fill={txnSort.col === "jenis" && txnSort.dir === "asc" ? "white" : "rgba(255,255,255,0.3)"} />
                              </svg>
                              <svg width="8" height="5" viewBox="0 0 8 5">
                                <polygon points="4,5 8,0 0,0" fill={txnSort.col === "jenis" && txnSort.dir === "desc" ? "white" : "rgba(255,255,255,0.3)"} />
                              </svg>
                            </span>
                          </span>
                        </th>
                      )}
                      <th
                        onClick={() => handleTxnSort("jumlah")}
                        className="cursor-pointer select-none px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-red-100 hover:bg-red-800"
                      >
                        <span className="inline-flex items-center justify-end gap-1">
                          Jumlah
                          <span className="inline-flex flex-col leading-none">
                            <svg width="8" height="5" viewBox="0 0 8 5" className="mb-0.5">
                              <polygon points="4,0 8,5 0,5" fill={txnSort.col === "jumlah" && txnSort.dir === "asc" ? "white" : "rgba(255,255,255,0.3)"} />
                            </svg>
                            <svg width="8" height="5" viewBox="0 0 8 5">
                              <polygon points="4,5 8,0 0,0" fill={txnSort.col === "jumlah" && txnSort.dir === "desc" ? "white" : "rgba(255,255,255,0.3)"} />
                            </svg>
                          </span>
                        </span>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-red-100">Dibuat Oleh</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pagedTxnList.map(t => (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          {t.programmeCode ? (
                            <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">{t.programmeCode}</span>
                          ) : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{t.date}</td>
                        <td className="px-4 py-3 text-sm text-gray-800">{t.description || <span className="text-gray-400">—</span>}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{t.category || <span className="text-gray-400">—</span>}</td>
                        {txnModal === "all" && (
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                              t.type === "income" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                            }`}>
                              {typeLabel(t.type)}
                            </span>
                          </td>
                        )}
                        <td className={`px-4 py-3 text-right text-sm font-semibold ${
                          txnModal === "all"
                            ? t.type === "income" ? "text-green-700" : "text-red-700"
                            : "text-gray-900"
                        }`}>
                          RM {Number(t.amount).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{t.createdByEmail || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer — total + pagination */}
            {!txnLoading && sortedTxnList.length > 0 && (
              <div className="border-t border-gray-100 px-6 py-3">
                {txnModal === "all" ? (
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span className="text-gray-500">
                      Pendapatan:{" "}
                      <span className="font-bold text-green-700">
                        RM {sortedTxnList.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0).toFixed(2)}
                      </span>
                    </span>
                    <span className="text-gray-500">
                      Perbelanjaan:{" "}
                      <span className="font-bold text-red-700">
                        RM {sortedTxnList.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0).toFixed(2)}
                      </span>
                    </span>
                    <span className="ml-auto text-gray-500">
                      {(() => {
                        const net = sortedTxnList.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0)
                                  - sortedTxnList.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
                        return (
                          <>
                            {net < 0 ? "Rugi" : "Untung"}:{" "}
                            <span className={`font-bold ${net < 0 ? "text-red-700" : "text-gray-900"}`}>
                              RM {net.toFixed(2)}
                            </span>
                          </>
                        );
                      })()}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">{sortedTxnList.length} rekod</span>
                    <span className="text-gray-500">
                      Jumlah:{" "}
                      <span className={`font-bold ${txnModal === "expense" ? "text-red-700" : "text-green-700"}`}>
                        RM {sortedTxnList.reduce((s, t) => s + Number(t.amount), 0).toFixed(2)}
                      </span>
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Pagination */}
            {!txnLoading && txnTotalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3">
                <button
                  onClick={() => setTxnPage(p => Math.max(1, p - 1))}
                  disabled={txnPage === 1}
                  aria-label="Halaman sebelumnya"
                  className="rounded-lg border border-gray-200 bg-white p-1.5 text-gray-700 transition hover:border-red-800 hover:bg-red-50 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <span className="text-xs text-gray-500">{txnPage} / {txnTotalPages}</span>
                <button
                  onClick={() => setTxnPage(p => Math.min(txnTotalPages, p + 1))}
                  disabled={txnPage === txnTotalPages}
                  aria-label="Halaman seterusnya"
                  className="rounded-lg border border-gray-200 bg-white p-1.5 text-gray-700 transition hover:border-red-800 hover:bg-red-50 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
