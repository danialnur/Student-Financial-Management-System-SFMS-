import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getAdminDashboardSummary } from "../services/dashboardService";
import PageHeader from "../components/PageHeader";

export default function AdminDashboard() {
  const { currentUser, userProfile, logout } = useAuth();
  const [summary, setSummary] = useState({ totalUsers: 0, totalTransactions: 0, pendingCount: 0, approvedCount: 0, rejectedCount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSummary = async () => {
      try {
        setLoading(true);
        const data = await getAdminDashboardSummary();
        setSummary(data);
      } catch (error) {
        console.error("Failed to load admin dashboard summary:", error);
      } finally {
        setLoading(false);
      }
    };
    loadSummary();
  }, []);

  const val = loading ? "—" : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title={`Selamat Datang, ${userProfile?.username ?? currentUser?.email}!`}
        subtitle={currentUser?.email}
        action={
          <button
            onClick={logout}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-red-900 hover:border-red-900 hover:text-white"
          >
            Log Keluar
          </button>
        }
      />

      <div className="mx-auto max-w-7xl p-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-red-800">
          Gambaran Sistem
        </p>
        <div className="mb-8 grid gap-4 md:grid-cols-5">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-purple-600">Pengguna</p>
            <h2 className="mt-2 text-2xl font-bold text-gray-900">{val ?? summary.totalUsers}</h2>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Transaksi</p>
            <h2 className="mt-2 text-2xl font-bold text-gray-900">{val ?? summary.totalTransactions}</h2>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Menunggu</p>
            <h2 className="mt-2 text-2xl font-bold text-gray-900">{val ?? summary.pendingCount}</h2>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-green-600">Diluluskan</p>
            <h2 className="mt-2 text-2xl font-bold text-gray-900">{val ?? summary.approvedCount}</h2>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-red-600">Ditolak</p>
            <h2 className="mt-2 text-2xl font-bold text-gray-900">{val ?? summary.rejectedCount}</h2>
          </div>
        </div>

        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-red-800">
          Tindakan Pantas
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <Link
            to="/advisor/approvals"
            className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-red-800 hover:shadow-md"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-800 font-bold text-xl transition group-hover:bg-red-900 group-hover:text-white">
              ✓
            </div>
            <h2 className="font-semibold text-gray-900">Semak Transaksi Menunggu</h2>
            <p className="mt-1 text-sm text-gray-500">Admin juga boleh meluluskan atau menolak transaksi.</p>
          </Link>

          <Link
            to="/admin/users"
            className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-red-800 hover:shadow-md"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-800 font-bold text-xl transition group-hover:bg-red-900 group-hover:text-white">
              ⚙
            </div>
            <h2 className="font-semibold text-gray-900">Urus Pengguna</h2>
            <p className="mt-1 text-sm text-gray-500">Tambah pengguna, kemaskini peranan dan buang akses.</p>
          </Link>

          <Link
            to="/admin/programmes"
            className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-red-800 hover:shadow-md"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-800 font-bold text-xl transition group-hover:bg-red-900 group-hover:text-white">
              ◈
            </div>
            <h2 className="font-semibold text-gray-900">Urus Program</h2>
            <p className="mt-1 text-sm text-gray-500">Tambah atau buang kod program yang digunakan dalam transaksi.</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
