import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getBendahariKelabSummary } from "../services/dashboardService";
import PageHeader from "../components/PageHeader";

export default function AdvisorDashboard() {
  const navigate = useNavigate();
  const { currentUser, userProfile, logout } = useAuth();

  const clubs = userProfile?.clubs ?? [];

  const [summary, setSummary] = useState({ totalIncome: 0, totalExpense: 0, balance: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clubs.length) { setLoading(false); return; }

    Promise.all(clubs.map(c => getBendahariKelabSummary(c)))
      .then(results => {
        const merged = results.reduce((acc, r) => ({
          totalIncome:  acc.totalIncome  + r.totalIncome,
          totalExpense: acc.totalExpense + r.totalExpense,
          balance:      acc.balance      + r.balance,
        }), { totalIncome: 0, totalExpense: 0, balance: 0 });
        setSummary(merged);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [clubs.join(",")]);

  const handleLogout = async () => { await logout(); navigate("/login"); };
  const fmtRM = (v) => `RM ${Number(v || 0).toFixed(2)}`;
  const val = loading ? "—" : null;

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

        {/* Clubs context banner */}
        {clubs.length > 0 ? (
          <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <span className="font-semibold">Kelab dipertanggungjawabkan: </span>
            {clubs.map((c, i) => (
              <span key={i} className="ml-1.5 inline-flex items-center rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-semibold">{c}</span>
            ))}
            <span className="mx-2 text-amber-400">·</span>
            <span className="text-xs text-amber-600">{currentUser?.email}</span>
          </div>
        ) : (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Akaun anda belum ditetapkan kelab. Sila hubungi admin untuk menetapkan kelab yang dipertanggungjawabkan.
          </div>
        )}

        {/* Summary cards */}
        {clubs.length > 0 && (() => {
          const isRugi = summary.balance < 0;
          return (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-green-600">Pendapatan</p>
                <h2 className="mt-2 text-xl font-bold text-gray-900">{val ?? fmtRM(summary.totalIncome)}</h2>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-red-600">Perbelanjaan</p>
                <h2 className="mt-2 text-xl font-bold text-gray-900">{val ?? fmtRM(summary.totalExpense)}</h2>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className={`text-xs font-semibold uppercase tracking-wider ${isRugi ? "text-red-600" : "text-blue-600"}`}>
                  {isRugi ? "Rugi" : "Untung"}
                </p>
                <h2 className={`mt-2 text-xl font-bold ${isRugi ? "text-red-600" : "text-gray-900"}`}>
                  {val ?? fmtRM(summary.balance)}
                </h2>
              </div>
            </div>
          );
        })()}

        {/* Quick actions */}
        <p className="text-xs font-semibold uppercase tracking-wider text-red-800">Tindakan Pantas</p>
        <div className="grid gap-4 md:grid-cols-2">
          <Link to="/advisor/approvals" className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-red-800 hover:shadow-md">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-800 font-bold text-xl transition group-hover:bg-red-900 group-hover:text-white">✓</div>
            <h2 className="font-semibold text-gray-900">Kelulusan Borang</h2>
            <p className="mt-1 text-sm text-gray-500">
              {clubs.length ? `Skop: ${clubs.join(", ")}` : "Sila tetapkan kelab anda terlebih dahulu."}
            </p>
          </Link>
          <Link to="/advisor/penyata-kewangan" className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-red-800 hover:shadow-md">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-800 font-bold text-xl transition group-hover:bg-red-900 group-hover:text-white">↓</div>
            <h2 className="font-semibold text-gray-900">Penyata Kewangan</h2>
            <p className="mt-1 text-sm text-gray-500">Lihat transaksi dan pratonton laporan PDF.</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
