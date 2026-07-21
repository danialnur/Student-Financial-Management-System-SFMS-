import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getAdminDashboardSummary } from "../services/dashboardService";
import PageHeader from "../components/PageHeader";

const ROLE_LABELS = {
  treasurer:       "Bendahari",
  advisor:         "Penasihat Kelab",
  admin:           "Admin",
  bendahari_kelab: "Bendahari Kelab",
  pegawai:         "Pegawai Kewangan",
};

const DETAIL_PAGE_SIZE = 10;

const fmtDate = (ts) =>
  ts?.toDate ? ts.toDate().toLocaleDateString("ms-MY", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const fmtRM = (v) => `RM ${Number(v || 0).toFixed(2)}`;

// Shared by pending/approved/rejected — identical columns and row rendering.
const SUBMISSION_COLUMNS = [
  { label: "Tarikh",        sortValue: (s) => s.createdAt?.seconds ?? 0 },
  { label: "Borang",        sortValue: (s) => s.formName || s.formType || "" },
  { label: "Kelab",         sortValue: (s) => s.createdByClub || "" },
  { label: "Dihantar Oleh", sortValue: (s) => s.createdByEmail || "" },
  { label: "Jenis",         sortValue: (s) => s.kind === "pdf" ? "PDF" : "Borang" },
];

const DETAIL_CONFIG = {
  users: {
    title:   "Senarai Pengguna",
    columns: [
      { label: "Nama Pengguna",     sortValue: (u) => u.username || "" },
      { label: "E-mel",             sortValue: (u) => u.email || "" },
      { label: "Peranan",           sortValue: (u) => ROLE_LABELS[u.role] ?? u.role ?? "" },
      { label: "Kelab / Kategori",  sortValue: (u) => u.club || (u.clubs ?? []).join(", ") || u.category || "" },
    ],
    getRows: (summary) => summary.users,
    renderRow: (u) => [
      u.username || "—",
      u.email,
      ROLE_LABELS[u.role] ?? u.role,
      u.club || (u.clubs ?? []).join(", ") || u.category || "—",
    ],
  },
  transactions: {
    title:   "Senarai Transaksi",
    columns: [
      { label: "Tarikh",      sortValue: (t) => t.date || "" },
      { label: "Kod Program", sortValue: (t) => t.programmeCode || "" },
      { label: "Jenis",       sortValue: (t) => t.type || "" },
      { label: "Jumlah",      sortValue: (t) => Number(t.amount || 0) },
      { label: "Oleh",        sortValue: (t) => t.createdByEmail || "" },
    ],
    getRows: (summary) => summary.transactions,
    renderRow: (t) => [
      t.date || "—",
      t.programmeCode || "—",
      t.type === "income" ? "Pendapatan" : "Perbelanjaan",
      `RM ${Number(t.amount || 0).toFixed(2)}`,
      t.createdByEmail || "—",
    ],
  },
  pending: {
    title:    "Borang & PDF Menunggu Kelulusan",
    columns:  SUBMISSION_COLUMNS,
    getRows:  (summary) => summary.submissions.filter(s => ["menunggu", "disemak"].includes(s.status)),
    renderRow: submissionRow,
  },
  approved: {
    title:    "Borang & PDF Diluluskan",
    columns:  SUBMISSION_COLUMNS,
    getRows:  (summary) => summary.submissions.filter(s => ["diluluskan", "selesai"].includes(s.status)),
    renderRow: submissionRow,
  },
  rejected: {
    title:    "Borang & PDF Ditolak",
    columns:  SUBMISSION_COLUMNS,
    getRows:  (summary) => summary.submissions.filter(s => s.status === "ditolak"),
    renderRow: submissionRow,
  },
};

function submissionRow(s) {
  return [
    fmtDate(s.createdAt),
    s.formName || s.formType || "—",
    s.createdByClub || "—",
    s.createdByEmail || "—",
    s.kind === "pdf" ? "PDF" : "Borang",
  ];
}

export default function AdminDashboard() {
  const { currentUser, userProfile, logout } = useAuth();
  const [summary, setSummary] = useState({
    totalUsers: 0, totalTransactions: 0, pendingCount: 0, approvedCount: 0, rejectedCount: 0,
    totalIncome: 0, totalExpense: 0, balance: 0,
    users: [], transactions: [], submissions: [],
  });
  const [loading, setLoading] = useState(true);
  const [detailModal, setDetailModal] = useState(null); // "users" | "transactions" | "pending" | "approved" | "rejected"
  const [detailPage, setDetailPage] = useState(1);

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

  const [sortCol, setSortCol] = useState(0);
  const [sortDir, setSortDir] = useState("asc"); // "asc" | "desc"

  const cfg  = detailModal ? DETAIL_CONFIG[detailModal] : null;
  const rows = useMemo(() => (cfg ? cfg.getRows(summary) : []), [cfg, summary]);

  const sortedRows = useMemo(() => {
    const sortValue = cfg?.columns[sortCol]?.sortValue;
    if (!sortValue) return rows;
    const list = [...rows];
    list.sort((a, b) => {
      const av = sortValue(a), bv = sortValue(b);
      const cmp = (typeof av === "number" && typeof bv === "number")
        ? av - bv
        : String(av).localeCompare(String(bv), undefined, { sensitivity: "base" });
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [rows, cfg, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / DETAIL_PAGE_SIZE));
  const pagedRows   = sortedRows.slice((detailPage - 1) * DETAIL_PAGE_SIZE, detailPage * DETAIL_PAGE_SIZE);

  const handleSort = (colIdx) => {
    if (sortCol === colIdx) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(colIdx);
      setSortDir("asc");
    }
  };

  const openDetail = (type) => {
    setDetailModal(type);
    setDetailPage(1);
    setSortCol(0);
    setSortDir("asc");
  };

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
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-red-800">
          Rumusan Sistem
        </p>
        <p className="mb-3 text-xs text-gray-400">
          Klik pada kad di bawah untuk melihat butiran.
        </p>
        <div className="mb-8 grid gap-4 md:grid-cols-5">
          <button onClick={() => openDetail("users")} className="rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-purple-400 hover:shadow-md">
            <p className="text-xs font-semibold uppercase tracking-wider text-purple-600">Pengguna</p>
            <h2 className="mt-2 text-2xl font-bold text-gray-900">{val ?? summary.totalUsers}</h2>
          </button>
          <button onClick={() => openDetail("transactions")} className="rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-blue-400 hover:shadow-md">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Transaksi</p>
            <h2 className="mt-2 text-2xl font-bold text-gray-900">{val ?? summary.totalTransactions}</h2>
          </button>
          <button onClick={() => openDetail("pending")} className="rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-amber-400 hover:shadow-md">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Menunggu</p>
            <h2 className="mt-2 text-2xl font-bold text-gray-900">{val ?? summary.pendingCount}</h2>
          </button>
          <button onClick={() => openDetail("approved")} className="rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-green-400 hover:shadow-md">
            <p className="text-xs font-semibold uppercase tracking-wider text-green-600">Diluluskan</p>
            <h2 className="mt-2 text-2xl font-bold text-gray-900">{val ?? summary.approvedCount}</h2>
          </button>
          <button onClick={() => openDetail("rejected")} className="rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-red-400 hover:shadow-md">
            <p className="text-xs font-semibold uppercase tracking-wider text-red-600">Ditolak</p>
            <h2 className="mt-2 text-2xl font-bold text-gray-900">{val ?? summary.rejectedCount}</h2>
          </button>
        </div>

        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-red-800">
          Rumusan Kewangan
        </p>
        <p className="mb-3 text-xs text-gray-400">
          Jumlah keseluruhan transaksi merentasi semua kelab dalam sistem.
        </p>
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-green-600">Jumlah Pendapatan</p>
            <h2 className="mt-2 text-2xl font-bold text-gray-900">{val ?? fmtRM(summary.totalIncome)}</h2>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-red-600">Jumlah Perbelanjaan</p>
            <h2 className="mt-2 text-2xl font-bold text-gray-900">{val ?? fmtRM(summary.totalExpense)}</h2>
          </div>
          {(() => {
            const bal    = summary.balance;
            const isRugi = bal < 0;
            return (
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className={`text-xs font-semibold uppercase tracking-wider ${isRugi ? "text-red-600" : "text-blue-600"}`}>
                  {isRugi ? "Jumlah Rugi" : "Jumlah Untung"}
                </p>
                <h2 className={`mt-2 text-2xl font-bold ${isRugi ? "text-red-600" : "text-gray-900"}`}>
                  {val ?? fmtRM(bal)}
                </h2>
              </div>
            );
          })()}
        </div>

        <div className="mb-8 flex justify-end">
          <Link
            to="/transaksi/sunting"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-red-900 hover:border-red-900 hover:text-white"
          >
            Sunting Transaksi
          </Link>
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
            <p className="mt-1 text-sm text-gray-500">Tambah, kemaskini atau buang program yang terlibat dalam sistem.</p>
          </Link>
        </div>
      </div>

      {/* ── Summary detail modal ── */}
      {detailModal && cfg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl">

            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h3 className="text-base font-bold text-gray-900">{cfg.title}</h3>
              <button
                onClick={() => setDetailModal(null)}
                className="rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {rows.length === 0 ? (
                <p className="p-6 text-sm text-gray-500">Tiada rekod dijumpai.</p>
              ) : (
                <table className="min-w-full">
                  <thead className="sticky top-0 bg-red-900">
                    <tr>
                      {cfg.columns.map((col, i) => (
                        <th key={col.label} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-red-100">
                          <button
                            type="button"
                            onClick={() => handleSort(i)}
                            className="flex items-center gap-1 uppercase tracking-wider hover:text-white"
                          >
                            {col.label}
                            <span className="text-red-300">
                              {sortCol === i ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
                            </span>
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pagedRows.map((row, i) => (
                      <tr key={row.id ?? i} className="hover:bg-gray-50">
                        {cfg.renderRow(row).map((cell, j) => (
                          <td key={j} className="px-4 py-3 text-sm text-gray-700">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer — pagination */}
            {rows.length > 0 && (
              <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3">
                <span className="text-xs text-gray-500">{rows.length} rekod</span>
                {totalPages > 1 && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setDetailPage(p => Math.max(1, p - 1))}
                      disabled={detailPage === 1}
                      aria-label="Halaman sebelumnya"
                      className="rounded-lg border border-gray-200 bg-white p-1.5 text-gray-700 transition hover:border-red-800 hover:bg-red-50 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <span className="text-xs text-gray-500">{detailPage} / {totalPages}</span>
                    <button
                      onClick={() => setDetailPage(p => Math.min(totalPages, p + 1))}
                      disabled={detailPage === totalPages}
                      aria-label="Halaman seterusnya"
                      className="rounded-lg border border-gray-200 bg-white p-1.5 text-gray-700 transition hover:border-red-800 hover:bg-red-50 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
