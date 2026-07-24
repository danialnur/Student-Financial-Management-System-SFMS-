// BendahariKelabAccessPage.jsx 

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  getAccessRequestsByClub, approveAccess, rejectAccess,
  revokeRejection, grantDirectAccess,
} from "../services/programmeAccessService";
import { getProgrammesByClub } from "../services/programmeService";
import { searchTreasurerByUsernameOrEmail } from "../services/userService";
import PageHeader from "../components/PageHeader";

const fmtDate = (ts) =>
  ts?.toDate ? ts.toDate().toLocaleDateString("ms-MY", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const CONFIRM_TYPES = {
  approve: {
    title:    "Luluskan Permohonan?",
    btnText:  "Ya, Luluskan",
    btnClass: "bg-green-600 hover:bg-green-700",
    iconBg:   "bg-green-100",
    icon: <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>,
  },
  reject: {
    title:    "Tolak Permohonan?",
    btnText:  "Ya, Tolak",
    btnClass: "bg-red-600 hover:bg-red-700",
    iconBg:   "bg-red-100",
    icon: <svg className="h-7 w-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>,
  },
  revoke_rejection: {
    title:    "Batalkan Penolakan?",
    btnText:  "Ya, Batal Tolakan",
    btnClass: "bg-amber-500 hover:bg-amber-600",
    iconBg:   "bg-amber-100",
    icon: <svg className="h-7 w-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>,
  },
  unlock_cancel: {
    title:    "Benarkan Memohon Semula?",
    btnText:  "Ya, Benarkan",
    btnClass: "bg-amber-500 hover:bg-amber-600",
    iconBg:   "bg-amber-100",
    icon: <svg className="h-7 w-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>,
  },
};

const XIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// Clickable sort arrows shown in table header
function SortArrows({ colKey, sortState, onSort }) {
  const active = sortState.col === colKey;
  const dir    = active ? sortState.dir : null;
  return (
    <button
      onClick={() => onSort(colKey)}
      className="ml-1.5 inline-flex flex-col items-center gap-0.5 align-middle"
      title="Klik untuk susun"
    >
      <svg viewBox="0 0 8 5" className={`h-2 w-2 ${dir === "asc" ? "fill-white" : "fill-red-400"}`}>
        <path d="M4 0L8 5H0z" />
      </svg>
      <svg viewBox="0 0 8 5" className={`h-2 w-2 ${dir === "desc" ? "fill-white" : "fill-red-400"}`}>
        <path d="M4 5L0 0H8z" />
      </svg>
    </button>
  );
}

export default function BendahariKelabAccessPage() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const club = userProfile?.club || "";

  const [records, setRecords]       = useState([]);
  const [programmes, setProgrammes] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [message, setMessage]       = useState("");
  const [errorMsg, setErrorMsg]     = useState("");
  const [actioning, setActioning]   = useState(null);
  const [confirm, setConfirm]       = useState(null);
  const [successPopup, setSuccessPopup] = useState(null); // success message shown in a popup

  // Search + date range for rejected section
  const [search, setSearch]       = useState("");
  const [dateFrom, setDateFrom]   = useState("");
  const [dateTo, setDateTo]       = useState("");

  // Sort state: { col: "date"|"code"|"name"|"user"|null, dir: "asc"|"desc"|null }
  // Default (col=null) → latest rejectedAt first
  const [sortState, setSortState] = useState({ col: null, dir: null });

  // "Add treasurer" modal state
  const [showGrantModal, setShowGrantModal]       = useState(false);
  const [grantSearch, setGrantSearch]             = useState("");
  const [grantResults, setGrantResults]           = useState([]);
  const [grantSearching, setGrantSearching]       = useState(false);
  const [grantSearchError, setGrantSearchError]   = useState("");
  const [selectedTreasurer, setSelectedTreasurer] = useState(null);
  const [selectedProgId, setSelectedProgId]       = useState("");
  const [granting, setGranting]                   = useState(false);
  const [grantError, setGrantError]               = useState("");
  const [showBlockedConfirm, setShowBlockedConfirm]         = useState(false);
  const [showAlreadyTreasurer, setShowAlreadyTreasurer]     = useState(false);
  const [showTreasurerAlreadyApproved, setShowTreasurerAlreadyApproved] = useState(false);
  const [approveBlocked, setApproveBlocked]                 = useState(null);

  // Loads every access record and every programme for this club in parallel —
  // both are needed together to know which programmes are still available to grant.
  const load = async () => {
    if (!club) { setLoading(false); return; }
    setLoading(true);
    try {
      const [recs, progs] = await Promise.all([
        getAccessRequestsByClub(club),
        getProgrammesByClub(club),
      ]);
      setRecords(recs);
      setProgrammes(progs);
    } catch {
      setErrorMsg("Gagal memuatkan data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [club]);

  // Shared wrapper for every approve/reject/revoke-rejection action below —
  // runs the given programmeAccessService function, shows a success popup, then reloads.
  const act = async (fn, id, popupMsg) => {
    setActioning(id); setErrorMsg("");
    try {
      await fn(id);
      setSuccessPopup(popupMsg);
      await load();
    } catch {
      setErrorMsg("Tindakan gagal. Sila cuba lagi.");
    } finally {
      setActioning(null);
    }
  };

  // Only one treasurer may hold approved access to a given programme at a
  // time, so approving a second request for the same programme is blocked
  // (with the existing occupant surfaced) instead of silently double-granting it.
  const handleApproveClick = (r) => {
    const occupant = records.find(
      rec => rec.programmeId === r.programmeId && rec.status === "approved" && rec.treasurerUid !== r.treasurerUid
    );
    if (occupant) {
      setApproveBlocked({ programmeCode: r.programmeCode, programmeName: r.programmeName, occupant });
      return;
    }
    setConfirm({ type: "approve", id: r.id, label: `${r.programmeCode} — ${r.treasurerUsername || r.treasurerEmail}` });
  };

  const handleConfirm = () => {
    if (!confirm) return;
    const { type, id, label } = confirm;
    setConfirm(null);
    if (type === "approve")               act(approveAccess,    id, `Akses "${label}" berjaya diluluskan.`);
    else if (type === "reject")           act(rejectAccess,     id, `Permohonan "${label}" berjaya ditolak.`);
    else if (type === "revoke_rejection") act(revokeRejection,  id, `Penolakan "${label}" berjaya dibatalkan. Bendahari boleh memohon semula.`);
    else if (type === "unlock_cancel")    act(revokeRejection,  id, `Bendahari kini boleh memohon semula untuk "${label}".`);
  };

  // Sort cycle: null → asc → desc → null
  const handleSort = (col) => {
    setSortState(prev => {
      if (prev.col !== col)         return { col, dir: "asc" };
      if (prev.dir === "asc")       return { col, dir: "desc" };
      return { col: null, dir: null };
    });
  };

  // Grant modal actions
  // "Grant Directly" flow, step 1: looks up a treasurer account by exact
  // username/email match so the bendahari_kelab can hand them access without
  // that treasurer having gone through the request flow themselves.
  const handleGrantSearch = async () => {
    if (!grantSearch.trim()) return;
    setGrantSearching(true);
    setGrantResults([]);
    setGrantSearchError("");
    setSelectedTreasurer(null);
    try {
      const results = await searchTreasurerByUsernameOrEmail(grantSearch.trim());
      if (results.length === 0) setGrantSearchError("Tiada bendahari dijumpai dengan nama pengguna atau e-mel tersebut.");
      else setGrantResults(results);
    } catch {
      setGrantSearchError("Gagal mencari pengguna. Sila cuba lagi.");
    } finally {
      setGrantSearching(false);
    }
  };

  const handleGrantClick = () => {
    if (!selectedTreasurer || !selectedProgId) return;

    const existing = records.find(
      r => r.treasurerUid === selectedTreasurer.id && r.programmeId === selectedProgId
    );

    // This treasurer already has approved access to this programme
    if (existing?.status === "approved") {
      setShowTreasurerAlreadyApproved(true);
      return;
    }

    // Another treasurer already has approved access to this programme
    const occupiedBy = records.find(
      r => r.programmeId === selectedProgId && r.status === "approved"
    );
    if (occupiedBy) {
      setShowAlreadyTreasurer(true);
      return;
    }

    // This treasurer was previously rejected — ask for confirmation
    if (existing?.status === "rejected") {
      setShowBlockedConfirm(true);
    } else {
      handleGrant();
    }
  };

  // "Grant Directly" flow, final step: writes an already-approved access
  // record for the selected treasurer+programme pair (see grantDirectAccess()).
  const handleGrant = async () => {
    if (!selectedTreasurer || !selectedProgId) return;
    const prog = programmes.find(p => p.id === selectedProgId);
    if (!prog) return;
    setGranting(true);
    setGrantError("");
    try {
      await grantDirectAccess({
        programmeId:       prog.id,
        programmeCode:     prog.code,
        programmeName:     prog.name,
        club,
        treasurerUid:      selectedTreasurer.id,
        treasurerEmail:    selectedTreasurer.email,
        treasurerUsername: selectedTreasurer.username || "",
      });
      setMessage(`Akses "${prog.code}" berjaya diberikan kepada ${selectedTreasurer.username || selectedTreasurer.email}.`);
      setShowGrantModal(false);
      resetGrantModal();
      await load();
    } catch {
      setGrantError("Gagal memberi akses. Sila cuba lagi.");
    } finally {
      setGranting(false);
    }
  };

  const resetGrantModal = () => {
    setGrantSearch(""); setGrantResults([]); setGrantSearchError("");
    setSelectedTreasurer(null); setSelectedProgId(""); setGrantError("");
    setShowBlockedConfirm(false); setShowAlreadyTreasurer(false); setShowTreasurerAlreadyApproved(false);
  };

  const pending  = records.filter(r => r.status === "pending");
  const rejected = records.filter(r => r.status === "rejected");

  // Filter then sort for rejected section
  const displayedRejected = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom + "T00:00:00") : null;
    const to   = dateTo   ? new Date(dateTo   + "T23:59:59") : null;

    const filtered = rejected.filter(r => {
      const user = (r.treasurerUsername || r.treasurerEmail || "").toLowerCase();
      if (q && !r.programmeCode.toLowerCase().includes(q) && !r.programmeName.toLowerCase().includes(q) && !user.includes(q)) return false;
      if (from || to) {
        const ts = r.rejectedAt?.toDate?.() ?? null;
        if (!ts) return false;
        if (from && ts < from) return false;
        if (to   && ts > to)   return false;
      }
      return true;
    });

    const { col, dir } = sortState;

    return [...filtered].sort((a, b) => {
      if (col === "date") {
        const diff = (a.rejectedAt?.seconds ?? 0) - (b.rejectedAt?.seconds ?? 0);
        return dir === "asc" ? diff : -diff;
      }
      if (col === "code") {
        const cmp = (a.programmeCode ?? "").localeCompare(b.programmeCode ?? "");
        return dir === "asc" ? cmp : -cmp;
      }
      if (col === "name") {
        const cmp = (a.programmeName ?? "").localeCompare(b.programmeName ?? "");
        return dir === "asc" ? cmp : -cmp;
      }
      if (col === "user") {
        const au = (a.treasurerUsername || a.treasurerEmail || "");
        const bu = (b.treasurerUsername || b.treasurerEmail || "");
        const cmp = au.localeCompare(bu);
        return dir === "asc" ? cmp : -cmp;
      }
      // default: latest date first
      return (b.rejectedAt?.seconds ?? 0) - (a.rejectedAt?.seconds ?? 0);
    });
  }, [rejected, search, dateFrom, dateTo, sortState]);

  const hasFilters   = search || dateFrom || dateTo;
  const clearFilters = () => { setSearch(""); setDateFrom(""); setDateTo(""); setSortState({ col: null, dir: null }); };

  const cfg = confirm ? CONFIRM_TYPES[confirm.type] : null;

  // Rejected section column headers with sort arrows
  const RejectedHeader = () => (
    <thead>
      <tr className="bg-red-900 text-left">
        {[
          { label: "Tarikh Tolak", col: "date" },
          { label: "Kod",          col: "code" },
          { label: "Nama Program", col: "name" },
          { label: "Bendahari",    col: "user" },
        ].map(({ label, col }) => (
          <th key={col} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-red-100">
            <span className="inline-flex items-center">
              {label}
              <SortArrows colKey={col} sortState={sortState} onSort={handleSort} />
            </span>
          </th>
        ))}
        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-red-100">Tindakan</th>
      </tr>
    </thead>
  );

  const simpleHeader = (cols) => (
    <thead>
      <tr className="bg-red-900 text-left">
        {cols.map(h => <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-red-100">{h}</th>)}
      </tr>
    </thead>
  );

  const requestRow = (r) => (
    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 text-sm text-gray-500">{fmtDate(r.requestedAt)}</td>
      <td className="px-4 py-3"><span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-800">{r.programmeCode}</span></td>
      <td className="px-4 py-3 text-sm text-gray-700">{r.programmeName}</td>
      <td className="px-4 py-3 text-xs text-gray-500">{r.treasurerUsername || r.treasurerEmail}</td>
      <td className="px-4 py-3">
        <div className="flex gap-2">
          <button onClick={() => handleApproveClick(r)} disabled={actioning === r.id} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-green-700 disabled:opacity-50">
            {actioning === r.id ? "..." : "Lulus"}
          </button>
          <button onClick={() => setConfirm({ type: "reject", id: r.id, label: `${r.programmeCode} — ${r.treasurerUsername || r.treasurerEmail}` })} disabled={actioning === r.id} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50">
            Tolak
          </button>
        </div>
      </td>
    </tr>
  );

  const rejectedRow = (r) => (
    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 text-sm text-gray-500">{fmtDate(r.rejectedAt)}</td>
      <td className="px-4 py-3"><span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-800">{r.programmeCode}</span></td>
      <td className="px-4 py-3 text-sm text-gray-700">{r.programmeName}</td>
      <td className="px-4 py-3 text-xs text-gray-500">
        {r.treasurerUsername || r.treasurerEmail}
        {r.cancelledBySelf && (
          <span className="ml-2 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
            Dibatalkan Sendiri
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <button
          onClick={() => setConfirm({
            type:  r.cancelledBySelf ? "unlock_cancel" : "revoke_rejection",
            id:    r.id,
            label: `${r.programmeCode} — ${r.treasurerUsername || r.treasurerEmail}`,
          })}
          disabled={actioning === r.id}
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
        >
          {actioning === r.id ? "..." : (r.cancelledBySelf ? "Benarkan Semula" : "Batal Tolakan")}
        </button>
      </td>
    </tr>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Pengurusan Akses Program"
        subtitle={club ? `Kelab: ${club}` : ""}
        action={
          <div className="flex gap-2">
            <button
              onClick={() => { resetGrantModal(); setShowGrantModal(true); }}
              className="rounded-lg bg-red-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-800"
            >
              + Beri Akses Terus
            </button>
            <button
              onClick={() => navigate(-1)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-red-900 hover:border-red-900 hover:text-white"
            >
              Kembali
            </button>
          </div>
        }
      />

      <div className="mx-auto max-w-5xl space-y-6 p-6">

        {!club && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-700">
            Akaun anda belum ditetapkan kelab.
          </div>
        )}

        {message && (
          <div className="flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            <span>{message}</span>
            <button onClick={() => setMessage("")} className="ml-4 shrink-0 text-green-500 hover:text-green-800 transition"><XIcon /></button>
          </div>
        )}
        {errorMsg && (
          <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg("")} className="ml-4 shrink-0 text-red-400 hover:text-red-700 transition"><XIcon /></button>
          </div>
        )}

        {club && (
          <>
            {/* ── Pending ── */}
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-amber-100 px-6 py-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-700">Permohonan Menunggu Kelulusan</h2>
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${pending.length > 0 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-400"}`}>{pending.length}</span>
              </div>
              {loading
                ? <p className="p-6 text-sm text-gray-500">Memuatkan...</p>
                : pending.length === 0
                  ? <p className="p-6 text-sm text-gray-500">Tiada permohonan baharu.</p>
                  : <div className="overflow-x-auto"><table className="min-w-full">{simpleHeader(["Tarikh Mohon", "Kod", "Nama Program", "Bendahari", "Tindakan"])}<tbody className="divide-y divide-gray-100">{pending.map(requestRow)}</tbody></table></div>
              }
            </div>

            {/* ── Rejected, with search, date range, sortable headers ── */}
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-red-100 px-6 py-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-red-700">Permohonan Ditolak</h2>
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${rejected.length > 0 ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-400"}`}>{rejected.length}</span>
              </div>
              <p className="border-b border-gray-100 px-6 py-2 text-xs text-gray-400">
                Klik "Batal Tolakan" untuk membenarkan bendahari memohon semula.
              </p>

              {!loading && rejected.length > 0 && (
                <div className="border-b border-gray-100 px-6 py-4 space-y-3">
                  {/* Free-text search */}
                  <div className="relative">
                    <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" /></svg>
                    <input
                      type="text"
                      placeholder="Cari kod program, nama program atau bendahari..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-9 text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-100"
                    />
                    {search && (
                      <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><XIcon /></button>
                    )}
                  </div>

                  {/* Date range */}
                  <div className="flex flex-wrap items-end gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-500">Tarikh Tolak Dari</label>
                      <input
                        type="date"
                        value={dateFrom}
                        max={dateTo || undefined}
                        onChange={e => setDateFrom(e.target.value)}
                        className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-100"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-500">Hingga</label>
                      <input
                        type="date"
                        value={dateTo}
                        min={dateFrom || undefined}
                        onChange={e => setDateTo(e.target.value)}
                        className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-100"
                      />
                    </div>
                    {(dateFrom || dateTo) && (
                      <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-500 hover:text-red-700 hover:border-red-200 transition">
                        Kosongkan Tarikh
                      </button>
                    )}
                  </div>

                  {/* Result count + clear */}
                  {hasFilters && (
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>
                        Menunjukkan <strong className="text-gray-800">{displayedRejected.length}</strong> daripada{" "}
                        <strong className="text-gray-800">{rejected.length}</strong> rekod
                      </span>
                      <button onClick={clearFilters} className="font-medium text-red-700 hover:underline">
                        Padam semua
                      </button>
                    </div>
                  )}
                </div>
              )}

              {loading
                ? <p className="p-6 text-sm text-gray-500">Memuatkan...</p>
                : rejected.length === 0
                  ? <p className="p-6 text-sm text-gray-500">Tiada permohonan ditolak.</p>
                  : displayedRejected.length === 0
                    ? <p className="p-6 text-sm text-gray-500">Tiada rekod yang sepadan dengan carian / julat tarikh.</p>
                    : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full">
                          <RejectedHeader />
                          <tbody className="divide-y divide-gray-100">{displayedRejected.map(rejectedRow)}</tbody>
                        </table>
                      </div>
                    )
              }
            </div>
          </>
        )}
      </div>

      {/* ── Confirm modal ── */}
      {confirm && cfg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
            <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${cfg.iconBg}`}>{cfg.icon}</div>
            <h3 className="mb-2 text-base font-bold text-gray-900">{cfg.title}</h3>
            <p className="mb-6 text-sm text-gray-500"><span className="font-semibold text-gray-800">{confirm.label}</span></p>
            <div className="flex gap-3">
              <button onClick={() => setConfirm(null)} className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">Batal</button>
              <button onClick={handleConfirm} className={`flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition ${cfg.btnClass}`}>{cfg.btnText}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Success popup (approve / reject / batal tolakan) ── */}
      {successPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="mb-2 text-base font-bold text-gray-900">Berjaya</h3>
            <p className="mb-6 text-sm text-gray-500">{successPopup}</p>
            <button onClick={() => setSuccessPopup(null)} className="w-full rounded-xl bg-red-900 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800">
              Okay
            </button>
          </div>
        </div>
      )}

      {/* ── Approve blocked (programme already has an active bendahari) ── */}
      {approveBlocked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <svg className="h-7 w-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <h3 className="mb-2 text-base font-bold text-gray-900">Tidak Dapat Meluluskan</h3>
            <p className="mb-1 text-sm text-gray-600">
              Program <span className="font-semibold text-red-800">{approveBlocked.programmeCode} — {approveBlocked.programmeName}</span> sudah mempunyai bendahari aktif.
            </p>
            <p className="mb-6 text-sm text-gray-500">
              Bendahari semasa:{" "}
              <span className="font-semibold text-gray-700">{approveBlocked.occupant.treasurerUsername || approveBlocked.occupant.treasurerEmail}</span>
            </p>
            <p className="mb-6 text-xs text-gray-400">
              Cabut akses bendahari semasa terlebih dahulu, atau tolak permohonan ini, sebelum meluluskan bendahari baharu.
            </p>
            <button onClick={() => setApproveBlocked(null)} className="w-full rounded-xl bg-red-900 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800">
              Okay
            </button>
          </div>
        </div>
      )}

      {/* ── Grant access modal ── */}
      {showGrantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h3 className="text-base font-bold text-gray-900">Beri Akses Terus</h3>
              <button onClick={() => setShowGrantModal(false)} className="text-gray-400 hover:text-gray-600"><XIcon /></button>
            </div>

            <div className="space-y-4 p-6">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Cari Bendahari (username atau e-mel)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={grantSearch}
                    onChange={e => { setGrantSearch(e.target.value); setGrantSearchError(""); }}
                    onKeyDown={e => e.key === "Enter" && handleGrantSearch()}
                    placeholder="cth. tres1 atau tres1@utm.my"
                    className="flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-100"
                  />
                  <button onClick={handleGrantSearch} disabled={grantSearching || !grantSearch.trim()} className="rounded-xl bg-red-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-50">
                    {grantSearching ? "..." : "Cari"}
                  </button>
                </div>
                {grantSearchError && <p className="mt-1.5 text-xs text-red-600">{grantSearchError}</p>}
              </div>

              {grantResults.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-gray-500">Pilih bendahari:</p>
                  {grantResults.map(u => (
                    <button
                      key={u.id}
                      onClick={() => setSelectedTreasurer(u)}
                      className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition ${selectedTreasurer?.id === u.id ? "border-red-900 bg-red-50" : "border-gray-200 hover:border-red-300 hover:bg-gray-50"}`}
                    >
                      <span className="font-semibold text-gray-800">{u.username}</span>
                      <span className="ml-2 text-xs text-gray-500">{u.email}</span>
                      {selectedTreasurer?.id === u.id && <span className="float-right text-xs font-semibold text-red-800">✓ Dipilih</span>}
                    </button>
                  ))}
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Pilih Program</label>
                <select value={selectedProgId} onChange={e => setSelectedProgId(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-100">
                  <option value="">— Pilih program —</option>
                  {programmes.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                </select>
              </div>

              {grantError && <p className="text-xs text-red-600">{grantError}</p>}
            </div>

            <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
              <button onClick={() => setShowGrantModal(false)} className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">Batal</button>
              <button
                onClick={handleGrantClick}
                disabled={!selectedTreasurer || !selectedProgId || granting}
                className="flex-1 rounded-xl bg-red-900 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-50"
              >
                {granting ? "Memberi akses..." : "Beri Akses"}
              </button>
            </div>

            {/* Treasurer already approved for this programme overlay */}
            {showTreasurerAlreadyApproved && (() => {
              const prog = programmes.find(p => p.id === selectedProgId);
              return (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/95 p-6">
                  <div className="text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100">
                      <svg className="h-7 w-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9-3.75h.008v.008H12V8.25z" />
                      </svg>
                    </div>
                    <h4 className="mb-2 text-base font-bold text-gray-900">Bendahari Sudah Mempunyai Akses</h4>
                    <p className="mb-6 text-sm text-gray-600">
                      <span className="font-semibold text-gray-800">{selectedTreasurer?.username || selectedTreasurer?.email}</span>{" "}
                      sudah diluluskan sebagai bendahari untuk program{" "}
                      <span className="font-semibold text-red-800">{prog?.code} — {prog?.name}</span>.
                    </p>
                    <button
                      onClick={() => setShowTreasurerAlreadyApproved(false)}
                      className="w-full rounded-xl bg-red-900 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800"
                    >
                      Okay
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Already-has-treasurer overlay */}
            {showAlreadyTreasurer && (() => {
              const prog      = programmes.find(p => p.id === selectedProgId);
              const occupant  = records.find(
                r => r.programmeId === selectedProgId && r.status === "approved" && r.treasurerUid !== selectedTreasurer?.id
              );
              return (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/95 p-6">
                  <div className="text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
                      <svg className="h-7 w-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                    </div>
                    <h4 className="mb-2 text-base font-bold text-gray-900">Tidak Dapat Menambah Bendahari</h4>
                    <p className="mb-1 text-sm text-gray-600">
                      Program <span className="font-semibold text-red-800">{prog?.code} — {prog?.name}</span> sudah mempunyai bendahari yang diluluskan.
                    </p>
                    {occupant && (
                      <p className="mb-5 text-sm text-gray-500">
                        Bendahari semasa:{" "}
                        <span className="font-semibold text-gray-700">{occupant.treasurerUsername || occupant.treasurerEmail}</span>
                      </p>
                    )}
                    <p className="mb-6 text-xs text-gray-400">
                      Cabut akses bendahari semasa terlebih dahulu sebelum menetapkan bendahari baharu.
                    </p>
                    <button
                      onClick={() => setShowAlreadyTreasurer(false)}
                      className="w-full rounded-xl bg-red-900 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800"
                    >
                      Okay
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Blocked confirmation overlay inside modal */}
            {showBlockedConfirm && (() => {
              const prog = programmes.find(p => p.id === selectedProgId);
              return (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/95 p-6">
                  <div className="text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
                      <svg className="h-7 w-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                      </svg>
                    </div>
                    <h4 className="mb-2 text-base font-bold text-gray-900">Bendahari Telah Ditolak</h4>
                    <p className="mb-1 text-sm text-gray-600">
                      <span className="font-semibold text-gray-800">{selectedTreasurer?.username || selectedTreasurer?.email}</span>{" "}
                      pernah ditolak untuk program{" "}
                      <span className="font-semibold text-red-800">{prog?.code}</span>.
                    </p>
                    <p className="mb-6 text-sm text-gray-500">
                      Adakah anda ingin memberi akses terus kepada bendahari ini?
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowBlockedConfirm(false)}
                        className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                      >
                        Tidak, Batal
                      </button>
                      <button
                        onClick={() => { setShowBlockedConfirm(false); handleGrant(); }}
                        disabled={granting}
                        className="flex-1 rounded-xl bg-red-900 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-50"
                      >
                        Ya, Beri Akses
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
