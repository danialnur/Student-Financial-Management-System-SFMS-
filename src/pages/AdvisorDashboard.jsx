import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getBendahariKelabSummary } from "../services/dashboardService";
import { getPendingBendahariKelabForClubs, approveAccount, rejectAccount } from "../services/userService";
import PageHeader from "../components/PageHeader";

export default function AdvisorDashboard() {
  const navigate = useNavigate();
  const { currentUser, userProfile, logout } = useAuth();

  const clubs = userProfile?.clubs ?? [];

  const [summary, setSummary] = useState({ totalIncome: 0, totalExpense: 0, balance: 0 });
  const [loading, setLoading] = useState(true);

  const [pendingAccounts, setPendingAccounts]   = useState([]);
  const [loadingPending, setLoadingPending]     = useState(true);
  const [confirmAccount, setConfirmAccount]     = useState(null); // { id, action: "approve"|"reject", email }
  const [accountActionId, setAccountActionId]   = useState("");
  const [accountSuccessMsg, setAccountSuccessMsg] = useState("");
  const [accountError, setAccountError]         = useState("");

  const loadPendingAccounts = () => {
    if (!clubs.length) { setPendingAccounts([]); setLoadingPending(false); return; }
    setLoadingPending(true);
    getPendingBendahariKelabForClubs(clubs)
      .then(setPendingAccounts)
      .catch(console.error)
      .finally(() => setLoadingPending(false));
  };

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

  useEffect(() => {
    loadPendingAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubs.join(",")]);

  const handleConfirmedAccountAction = async () => {
    if (!confirmAccount) return;
    const { id, action } = confirmAccount;
    try {
      setAccountActionId(id); setConfirmAccount(null); setAccountError("");
      if (action === "approve") await approveAccount(id, { uid: currentUser.uid, email: currentUser.email });
      else await rejectAccount(id, { uid: currentUser.uid, email: currentUser.email });
      loadPendingAccounts();
      setAccountSuccessMsg(action === "approve" ? "Akaun berjaya diluluskan." : "Akaun berjaya ditolak.");
    } catch (e) {
      console.error(e);
      setAccountError("Gagal mengemaskini akaun.");
    } finally {
      setAccountActionId("");
    }
  };

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

        {/* Pending bendahari_kelab account approvals */}
        {clubs.length > 0 && (
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-red-800">
              Akaun Bendahari Kelab Menunggu Kelulusan
            </p>
            {accountError && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{accountError}</div>}
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
              {loadingPending ? (
                <p className="p-6 text-sm text-gray-500">Memuatkan akaun menunggu...</p>
              ) : pendingAccounts.length === 0 ? (
                <p className="p-6 text-sm text-gray-500">Tiada akaun menunggu kelulusan.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-red-900 text-left">
                        {["Nama Penuh", "E-mel", "Kelab", "Tindakan"].map(h => (
                          <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-red-100">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-red-50">
                      {pendingAccounts.map(item => (
                        <tr key={item.id} className="hover:bg-red-50 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.fullName || "—"}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{item.email}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">{item.club}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button
                                onClick={() => setConfirmAccount({ id: item.id, action: "approve", email: item.email })}
                                disabled={accountActionId === item.id}
                                className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-green-700 disabled:opacity-60"
                              >
                                Lulus
                              </button>
                              <button
                                onClick={() => setConfirmAccount({ id: item.id, action: "reject", email: item.email })}
                                disabled={accountActionId === item.id}
                                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                              >
                                Tolak
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
        )}
      </div>

      {/* Confirm approve/reject account */}
      {confirmAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
              <svg className="h-7 w-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h3 className="mb-2 text-base font-bold text-gray-900">
              {confirmAccount.action === "approve" ? "Luluskan Akaun Ini?" : "Tolak Akaun Ini?"}
            </h3>
            <p className="mb-6 text-sm text-gray-600">
              <span className="font-semibold text-gray-800">{confirmAccount.email}</span>{" "}
              {confirmAccount.action === "approve" ? "akan diluluskan sebagai Bendahari Kelab." : "akan ditolak dan tidak dapat log masuk."}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmAccount(null)} className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">Batal</button>
              <button onClick={handleConfirmedAccountAction} className="flex-1 rounded-xl bg-red-900 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800">Ya, Teruskan</button>
            </div>
          </div>
        </div>
      )}

      {/* Account action success */}
      {accountSuccessMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="mb-2 text-base font-bold text-gray-900">Berjaya</h3>
            <p className="mb-6 text-sm text-gray-500">{accountSuccessMsg}</p>
            <button onClick={() => setAccountSuccessMsg("")} className="w-full rounded-xl bg-red-900 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800">OK</button>
          </div>
        </div>
      )}
    </div>
  );
}
