import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getApprovedTransactionsForReport } from "../services/reportService";
import PageHeader from "../components/PageHeader";

const PAGE_SIZE = 10;
const typeLabel = (t) => (t === "income" ? "Pendapatan" : "Perbelanjaan");

const XIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

function SortHeader({ label, colKey, sortState, onSort }) {
  const active = sortState.col === colKey;
  return (
    <button
      type="button"
      onClick={() => onSort(colKey)}
      className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-red-100 hover:text-white"
    >
      {label}
      <span className="flex flex-col leading-none">
        <span className={active && sortState.dir === "asc" ? "text-white" : "text-red-400"}>▲</span>
        <span className={active && sortState.dir === "desc" ? "text-white" : "text-red-400"}>▼</span>
      </span>
    </button>
  );
}

function canEditTransaction(t, { userRole, currentUser, userProfile }) {
  if (userRole === "admin") return true;
  if (userRole === "treasurer") return t.createdBy === currentUser.uid;
  if (userRole === "bendahari_kelab") return t.createdByClub === userProfile?.club;
  return false;
}

export default function TransactionEditSearchPage() {
  const navigate = useNavigate();
  const { currentUser, userRole, userProfile, selectedClub } = useAuth();

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [errorMsg, setErrorMsg]         = useState("");

  const [search, setSearch]         = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortState, setSortState]   = useState({ col: null, dir: null });
  const [page, setPage]             = useState(1);

  useEffect(() => {
    if (userRole === "pegawai" && !selectedClub) {
      navigate("/pegawai/pilih-kelab", { replace: true });
    }
  }, [userRole, selectedClub, navigate]);

  useEffect(() => {
    if (!currentUser?.uid || !userRole) return;
    if (userRole === "pegawai" && !selectedClub) return;

    const params = { role: userRole };
    if (userRole === "treasurer")           params.uid   = currentUser.uid;
    else if (userRole === "bendahari_kelab") params.club  = userProfile?.club;
    else if (userRole === "advisor")         params.clubs = userProfile?.clubs;
    else if (userRole === "pegawai")         params.club  = selectedClub;

    setLoading(true);
    setErrorMsg("");
    getApprovedTransactionsForReport(params)
      .then(setTransactions)
      .catch((err) => {
        console.error(err);
        setErrorMsg("Gagal memuatkan transaksi.");
      })
      .finally(() => setLoading(false));
  }, [currentUser, userRole, userProfile, selectedClub]);

  const handleSort = (col) => {
    setSortState((prev) => {
      if (prev.col !== col)   return { col, dir: "asc" };
      if (prev.dir === "asc") return { col, dir: "desc" };
      return { col: null, dir: null };
    });
    setPage(1);
  };

  const displayed = useMemo(() => {
    const q = search.trim().toLowerCase();

    let filtered = transactions;
    if (typeFilter !== "all") filtered = filtered.filter((t) => t.type === typeFilter);
    if (q) {
      filtered = filtered.filter((t) => {
        const haystack = [
          t.programmeCode, t.programmeName, t.description, t.category,
          t.createdByEmail, t.date, String(t.amount ?? ""),
        ].join(" ").toLowerCase();
        return haystack.includes(q);
      });
    }

    const { col, dir } = sortState;
    if (!col) return filtered;
    return [...filtered].sort((a, b) => {
      let va, vb;
      switch (col) {
        case "tarikh":   va = a.date || "";                 vb = b.date || ""; break;
        case "program":  va = a.programmeCode || "";         vb = b.programmeCode || ""; break;
        case "kategori": va = a.category || "";              vb = b.category || ""; break;
        case "jenis":    va = a.type || "";                  vb = b.type || ""; break;
        case "jumlah":   va = Number(a.amount || 0);          vb = Number(b.amount || 0); break;
        case "oleh":     va = a.createdByEmail || "";         vb = b.createdByEmail || ""; break;
        default:         return 0;
      }
      if (typeof va === "number") return dir === "asc" ? va - vb : vb - va;
      const cmp = va.localeCompare(vb);
      return dir === "asc" ? cmp : -cmp;
    });
  }, [transactions, search, typeFilter, sortState]);

  const totalPages = Math.max(1, Math.ceil(displayed.length / PAGE_SIZE));
  const paged = displayed.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Sunting Transaksi"
        subtitle="Cari transaksi di bawah jumlah pendapatan atau perbelanjaan, kemudian pilih untuk menyunting."
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
        {errorMsg && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          {/* Search + filter */}
          <div className="border-b border-gray-100 px-6 py-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                type="text"
                placeholder="Cari program, catatan, kategori, tarikh atau jumlah..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-9 text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-100"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <XIcon />
                </button>
              )}
            </div>
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-100"
            >
              <option value="all">Semua Jenis</option>
              <option value="income">Pendapatan</option>
              <option value="expense">Perbelanjaan</option>
            </select>
          </div>

          {loading ? (
            <p className="p-6 text-sm text-gray-500">Memuatkan transaksi...</p>
          ) : displayed.length === 0 ? (
            <p className="p-6 text-sm text-gray-500">Tiada transaksi yang sepadan.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-red-900 text-left">
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-red-100">Tindakan</th>
                      <th className="px-4 py-3"><SortHeader label="Tarikh" colKey="tarikh" sortState={sortState} onSort={handleSort} /></th>
                      <th className="px-4 py-3"><SortHeader label="Program" colKey="program" sortState={sortState} onSort={handleSort} /></th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-red-100">Catatan</th>
                      <th className="px-4 py-3"><SortHeader label="Kategori" colKey="kategori" sortState={sortState} onSort={handleSort} /></th>
                      <th className="px-4 py-3"><SortHeader label="Jenis" colKey="jenis" sortState={sortState} onSort={handleSort} /></th>
                      <th className="px-4 py-3"><SortHeader label="Jumlah" colKey="jumlah" sortState={sortState} onSort={handleSort} /></th>
                      <th className="px-4 py-3"><SortHeader label="Oleh" colKey="oleh" sortState={sortState} onSort={handleSort} /></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-50">
                    {paged.map((t) => (
                      <tr key={t.id} className="hover:bg-red-50 transition-colors">
                        <td className="px-4 py-3">
                          {canEditTransaction(t, { userRole, currentUser, userProfile }) ? (
                            <Link
                              to={`/transaksi/sunting/${t.id}`}
                              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                            >
                              Sunting
                            </Link>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{t.date}</td>
                        <td className="px-4 py-3">
                          {t.programmeCode ? (
                            <div>
                              <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">
                                {t.programmeCode}
                              </span>
                              <p className="mt-0.5 text-xs text-gray-500">{t.programmeName}</p>
                            </div>
                          ) : <span className="text-xs text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{t.description || "—"}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{t.category}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{typeLabel(t.type)}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">RM {Number(t.amount || 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{t.createdByEmail || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3 text-sm text-gray-600">
                  <span>Muka surat {page} daripada {totalPages} · {displayed.length} rekod</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Sebelumnya
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Seterusnya
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
