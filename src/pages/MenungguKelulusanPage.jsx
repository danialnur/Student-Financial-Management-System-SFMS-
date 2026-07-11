import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/PageHeader";

const ROLE_LABELS = {
  bendahari_kelab: "Bendahari Kelab",
  advisor:         "Penasihat Kelab",
  pegawai:         "Pegawai Kewangan",
};

const DASHBOARD_PATH_BY_ROLE = {
  bendahari_kelab: "/bendahari-kelab/dashboard",
  advisor:         "/advisor/dashboard",
  pegawai:         "/pegawai/dashboard",
};

const MESSAGE_BY_STATUS = {
  pending_advisor: (club) =>
    `Akaun anda sedang menunggu kelulusan Penasihat Kelab bagi ${club || "kelab yang didaftarkan"}.`,
  pending_admin: () =>
    "Akaun anda sedang menunggu kelulusan Pentadbir Sistem.",
  rejected: () =>
    "Permohonan akaun anda telah ditolak. Sila hubungi Pentadbir jika ini adalah suatu kesilapan.",
};

export default function MenungguKelulusanPage() {
  const navigate = useNavigate();
  const { currentUser, userRole, userProfile, loading, logout, refreshProfile } = useAuth();

  const handleLogout = async () => { await logout(); navigate("/login"); };

  const handleRecheck = async () => {
    await refreshProfile();
  };

  useEffect(() => {
    if (userProfile?.accountStatus === "active") {
      navigate(DASHBOARD_PATH_BY_ROLE[userRole] ?? "/login", { replace: true });
    }
  }, [userProfile, userRole, navigate]);

  const status = userProfile?.accountStatus;
  const message = MESSAGE_BY_STATUS[status]?.(userProfile?.club) ?? "Akaun anda sedang menunggu kelulusan.";
  const isRejected = status === "rejected";

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Menunggu Kelulusan"
        action={
          <button onClick={handleLogout} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-red-900 hover:border-red-900 hover:text-white">
            Log Keluar
          </button>
        }
      />

      <div className="mx-auto flex max-w-lg flex-col items-center gap-5 p-6 pt-16 text-center">
        <div className={`flex h-16 w-16 items-center justify-center rounded-full ${isRejected ? "bg-red-100" : "bg-amber-100"}`}>
          <svg className={`h-8 w-8 ${isRejected ? "text-red-600" : "text-amber-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {isRejected ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            )}
          </svg>
        </div>

        <h2 className="text-xl font-bold text-gray-900">
          {isRejected ? "Permohonan Ditolak" : "Akaun Belum Aktif"}
        </h2>

        <p className="text-sm text-gray-600">{message}</p>

        <div className="w-full rounded-xl border border-gray-200 bg-white p-4 text-left text-sm text-gray-600 shadow-sm">
          <p><span className="font-semibold text-gray-800">E-mel:</span> {currentUser?.email}</p>
          <p className="mt-1"><span className="font-semibold text-gray-800">Peranan dimohon:</span> {ROLE_LABELS[userRole] ?? userRole}</p>
        </div>

        {!isRejected && (
          <button
            onClick={handleRecheck}
            disabled={loading}
            className="rounded-xl bg-red-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-800 disabled:opacity-60"
          >
            {loading ? "Menyemak..." : "Semak Semula Status"}
          </button>
        )}
      </div>
    </div>
  );
}
