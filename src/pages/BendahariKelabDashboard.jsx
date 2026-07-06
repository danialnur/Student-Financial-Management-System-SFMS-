import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getBendahariKelabSummary } from "../services/dashboardService";
import { getPendingBorangByClub } from "../services/formService";
import { getAccessRequestsByClub } from "../services/programmeAccessService";
import PageHeader from "../components/PageHeader";

const fmtRM = (v) => `RM ${Number(v || 0).toFixed(2)}`;

export default function BendahariKelabDashboard() {
  const navigate = useNavigate();
  const { currentUser, userProfile, logout } = useAuth();

  const club = userProfile?.club || "";

  const [summary, setSummary]         = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [pendingForms, setPendingForms]         = useState(0);
  const [loadingForms, setLoadingForms]         = useState(true);
  const [pendingAccessCount, setPendingAccessCount] = useState(0);

  useEffect(() => {
    if (!club) return;
    setLoadingSummary(true);
    getBendahariKelabSummary(club)
      .then(setSummary)
      .catch(console.error)
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

  const statCard = (label, value, color) => (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className={`text-xs font-semibold uppercase tracking-wider ${color}`}>{label}</p>
      <h2 className="mt-2 text-2xl font-bold text-gray-900">{value}</h2>
    </div>
  );

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
            {loadingSummary ? (
              <p className="text-sm text-gray-400">Memuatkan ringkasan...</p>
            ) : summary && (() => {
              const isRugi = summary.balance < 0;
              return (
                <div className="grid gap-4 md:grid-cols-3">
                  {statCard("Jumlah Pendapatan",  fmtRM(summary.totalIncome),  "text-green-600")}
                  {statCard("Jumlah Perbelanjaan", fmtRM(summary.totalExpense), "text-red-600")}
                  <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <p className={`text-xs font-semibold uppercase tracking-wider ${isRugi ? "text-red-600" : "text-blue-600"}`}>
                      {isRugi ? "Rugi Keseluruhan" : "Untung Keseluruhan"}
                    </p>
                    <h2 className={`mt-2 text-2xl font-bold ${isRugi ? "text-red-600" : "text-gray-900"}`}>
                      {fmtRM(summary.balance)}
                    </h2>
                  </div>
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
    </div>
  );
}
