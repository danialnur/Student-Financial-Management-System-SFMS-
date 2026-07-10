import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getPendingBorang } from "../services/formService";
import PageHeader from "../components/PageHeader";

export default function PegawaiDashboard() {
  const navigate = useNavigate();
  const { currentUser, userProfile, logout, selectedClub } = useAuth();

  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPendingBorang()
      .then((list) => setPendingCount(list.length))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (userProfile?.category && !selectedClub) {
      navigate("/pegawai/pilih-kelab", { replace: true });
    }
  }, [userProfile, selectedClub, navigate]);

  const handleLogout = async () => { await logout(); navigate("/login"); };

  const category = userProfile?.category || "";

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

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
          <div>
            <span className="font-semibold">Log masuk sebagai: </span>{currentUser?.email}
            <span className="mx-2 text-indigo-300">·</span>Pegawai Kewangan
            {category && (
              <>
                <span className="mx-2 text-indigo-300">·</span>
                <span className="font-semibold">Kategori: </span>{category}
              </>
            )}
            {selectedClub && (
              <>
                <span className="mx-2 text-indigo-300">·</span>
                <span className="font-semibold">Kelab Diselia: </span>{selectedClub}
              </>
            )}
          </div>
          {category && (
            <Link
              to="/pegawai/pilih-kelab"
              className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 shadow-sm transition hover:bg-indigo-100"
            >
              Tukar Kelab
            </Link>
          )}
        </div>

        {!category && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
            Akaun anda belum ditetapkan kategori kelab. Sila hubungi pentadbir.
          </div>
        )}

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Borang Menunggu Kelulusan</p>
            <h2 className="mt-2 text-3xl font-bold text-gray-900">
              {loading ? <span className="text-gray-300">…</span> : pendingCount}
            </h2>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            to="/pegawai/approvals"
            className="flex items-center justify-between rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm transition hover:bg-indigo-50"
          >
            <div>
              <p className="text-sm font-bold text-gray-900">Kelulusan Borang Kewangan UTM</p>
              <p className="mt-0.5 text-xs text-gray-500">Semak, luluskan atau tolak borang yang dihantar oleh bendahari</p>
            </div>
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${pendingCount > 0 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-400"}`}>
              {loading ? "…" : pendingCount}
            </span>
          </Link>

          <Link
            to="/pegawai/penyata-kewangan"
            className="flex items-center justify-between rounded-2xl border border-green-200 bg-white p-5 shadow-sm transition hover:bg-green-50"
          >
            <div>
              <p className="text-sm font-bold text-gray-900">Penyata Kewangan Kelab</p>
              <p className="mt-0.5 text-xs text-gray-500">
                {selectedClub ? `Lihat rumusan kewangan bagi ${selectedClub}` : "Pilih kelab untuk lihat laporan"}
              </p>
            </div>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700 text-lg font-bold">↓</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
