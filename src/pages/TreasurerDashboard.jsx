import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getTreasurerDashboardSummary } from "../services/dashboardService";
import { getProgrammesByClub } from "../services/programmeService";
import { MAX_PENDING_REQUESTS, getAccessByTreasurer } from "../services/programmeAccessService";
import { getTransactionsByUser } from "../services/transactionService";
import { useIdleTimer } from "../hooks/useIdleTimer";
import PageHeader from "../components/PageHeader";
import { CLUB_CATEGORIES } from "../config/clubsConfig";

const CATEGORIES   = Object.keys(CLUB_CATEGORIES);
const EMPTY_SUMMARY = { totalIncome: 0, totalExpense: 0, balance: 0 };

// Reverse map: club name → category
const CLUB_TO_CATEGORY = {};
Object.entries(CLUB_CATEGORIES).forEach(([cat, clubs]) => {
  clubs.forEach(c => { CLUB_TO_CATEGORY[c] = cat; });
});

export default function TreasurerDashboard() {
  const { currentUser, userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const uid      = currentUser?.uid;
  const clubRef  = useRef(null);

  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedClub, setSelectedClub]         = useState(null);
  const [clubSearch, setClubSearch]             = useState("");
  const [showClubOptions, setShowClubOptions]   = useState(false);

  const [programmes, setProgrammes]               = useState([]);
  const [loadingProgrammes, setLoadingProgrammes] = useState(false);

  const [accessMap, setAccessMap]               = useState({});
  const [allAccessRecords, setAllAccessRecords] = useState([]);

  const [selectedProgramme, setSelectedProgramme] = useState(null);
  const [summary, setSummary]                     = useState(EMPTY_SUMMARY);
  const [loading, setLoading]                     = useState(false);

  const [shortcutSearch, setShortcutSearch] = useState("");
  const [progSearch, setProgSearch]         = useState("");

  const [txnModal, setTxnModal]     = useState(null); // "income" | "expense" | "all"
  const [txnList, setTxnList]       = useState([]);
  const [txnLoading, setTxnLoading] = useState(false);
  const [txnSort, setTxnSort]       = useState({ col: null, dir: null });

  // Load all access records on mount (for shortcuts + pending banner)
  useEffect(() => {
    if (!uid) return;
    getAccessByTreasurer(uid).then(setAllAccessRecords).catch(() => {});
  }, [uid]);

  const allPendingRequests = allAccessRecords.filter(r => r.status === "pending");
  const approvedShortcuts  = allAccessRecords.filter(r => r.status === "approved");

  const filteredShortcuts = useMemo(() => {
    const q = shortcutSearch.trim().toLowerCase();
    if (!q) return approvedShortcuts;
    return approvedShortcuts.filter(r =>
      r.programmeCode.toLowerCase().includes(q) ||
      r.programmeName.toLowerCase().includes(q) ||
      r.club.toLowerCase().includes(q)
    );
  }, [approvedShortcuts, shortcutSearch]);

  const filteredProgrammes = useMemo(() => {
    // Permanently-rejected programmes are hidden entirely from the picker —
    // there's nothing the treasurer can do with them (MAX_ATTEMPTS = 1, no retry).
    const visible = programmes.filter(p => accessMap[p.id]?.status !== "rejected");
    const q = progSearch.trim().toLowerCase();
    if (!q) return visible;
    return visible.filter(p =>
      p.code.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q)
    );
  }, [programmes, progSearch, accessMap]);

  const handleExpire = useCallback(() => {
    if (uid) {
      localStorage.removeItem(`sfms_cat_${uid}`);
      localStorage.removeItem(`sfms_club_${uid}`);
      localStorage.removeItem(`sfms_prog_${uid}`);
    }
    setSelectedCategory(null);
    setSelectedClub(null);
    setClubSearch("");
    setProgSearch("");
    setShowClubOptions(false);
    setSelectedProgramme(null);
    setSummary(EMPTY_SUMMARY);
    setProgrammes([]);
    setAccessMap({});
  }, [uid]);

  useIdleTimer({
    uid,
    idleMs:    30 * 60 * 1000,  // 30 minutes idle
    sessionMs: 8  * 60 * 60 * 1000, // 8 hours hard cap
    onExpire:  handleExpire,
  });

  // Close club dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (clubRef.current && !clubRef.current.contains(e.target)) setShowClubOptions(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Restore last session from localStorage
  useEffect(() => {
    if (!uid) return;
    const cat  = localStorage.getItem(`sfms_cat_${uid}`);
    const club = localStorage.getItem(`sfms_club_${uid}`);
    if (cat && CATEGORIES.includes(cat)) {
      setSelectedCategory(cat);
      if (club && CLUB_CATEGORIES[cat]?.includes(club)) {
        setSelectedClub(club);
        setClubSearch(club);
      }
    }
  }, [uid]);

  // Load programmes + access records whenever club changes
  useEffect(() => {
    if (!selectedClub || !uid) return;
    const load = async () => {
      setLoadingProgrammes(true);
      try {
        const progs = await getProgrammesByClub(selectedClub);
        setProgrammes(progs);

        let map = {};
        try {
          const accessList = await getAccessByTreasurer(uid);
          accessList.forEach(r => {
            const existing = map[r.programmeId];
            if (!existing || (r.requestedAt?.seconds ?? 0) > (existing.requestedAt?.seconds ?? 0)) {
              map[r.programmeId] = r;
            }
          });
        } catch (e) {
          console.error("Failed to load access records:", e);
        }
        setAccessMap(map);

        // Restore last selected programme (only if still approved)
        const savedRaw = localStorage.getItem(`sfms_prog_${uid}`);
        if (savedRaw) {
          try {
            const { id } = JSON.parse(savedRaw);
            const saved  = progs.find(p => p.id === id);
            if (saved && map[id]?.status === "approved") {
              setSelectedProgramme(saved);
              // Keep the cached code/name/club in sync in case the programme was renamed
              // (or its club value corrected) since it was last explicitly selected —
              // other pages read this cache directly.
              localStorage.setItem(`sfms_prog_${uid}`, JSON.stringify({ id: saved.id, code: saved.code, name: saved.name }));
              if (saved.club) localStorage.setItem(`sfms_club_${uid}`, saved.club);
            } else {
              setSelectedProgramme(null);
              localStorage.removeItem(`sfms_prog_${uid}`);
            }
          } catch {}
        }
      } catch (err) {
        console.error("Failed to load programmes:", err);
      } finally {
        setLoadingProgrammes(false);
      }
    };
    load();
  }, [selectedClub, uid]);

  // Load financial summary when programme selected
  useEffect(() => {
    if (!selectedProgramme || !uid) return;
    const load = async () => {
      setLoading(true);
      try {
        const data = await getTreasurerDashboardSummary(uid, selectedProgramme.code);
        setSummary(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedProgramme, uid]);

  const handleCategorySelect = (cat) => {
    if (cat === selectedCategory) return;
    setSelectedCategory(cat);
    setSelectedClub(null);
    setClubSearch("");
    setProgSearch("");
    setSelectedProgramme(null);
    setSummary(EMPTY_SUMMARY);
    setProgrammes([]);
    setAccessMap({});
    if (uid) {
      localStorage.setItem(`sfms_cat_${uid}`, cat);
      localStorage.removeItem(`sfms_club_${uid}`);
      localStorage.removeItem(`sfms_prog_${uid}`);
    }
  };

  const handleClubSelect = (club) => {
    if (club !== selectedClub) {
      setSelectedProgramme(null);
      setSummary(EMPTY_SUMMARY);
      setProgSearch("");
      if (uid) localStorage.removeItem(`sfms_prog_${uid}`);
    }
    setSelectedClub(club);
    setClubSearch(club);
    setShowClubOptions(false);
    if (uid) localStorage.setItem(`sfms_club_${uid}`, club);
  };

  const handleProgrammeSelect = (p) => {
    setSelectedProgramme(p);
    setSummary(EMPTY_SUMMARY);
    if (uid) localStorage.setItem(`sfms_prog_${uid}`, JSON.stringify({ id: p.id, code: p.code, name: p.name }));
  };

  const goToRequestPage = (p) => {
    navigate("/treasurer/request-access", { state: { programme: p, club: selectedClub } });
  };

  const quickSelectProgramme = (r) => {
    const cat = CLUB_TO_CATEGORY[r.club];
    if (cat) {
      setSelectedCategory(cat);
      if (uid) localStorage.setItem(`sfms_cat_${uid}`, cat);
    }
    setSelectedClub(r.club);
    setClubSearch(r.club);
    setShowClubOptions(false);
    if (uid) localStorage.setItem(`sfms_club_${uid}`, r.club);
    const prog = { id: r.programmeId, code: r.programmeCode, name: r.programmeName };
    handleProgrammeSelect(prog);
  };

  const handleTxnSort = (col) => {
    setTxnSort(prev => {
      if (prev.col !== col) return { col, dir: "asc" };
      if (prev.dir === "asc") return { col, dir: "desc" };
      return { col: null, dir: null };
    });
  };

  const sortedTxnList = useMemo(() => {
    const { col, dir } = txnSort;
    if (!col) return txnList;
    return [...txnList].sort((a, b) => {
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
      if (col === "jumlah") {
        const va = Number(a.amount || 0), vb = Number(b.amount || 0);
        return dir === "asc" ? va - vb : vb - va;
      }
      return 0;
    });
  }, [txnList, txnSort]);

  const openTxnModal = async (type) => {
    setTxnModal(type);
    setTxnList([]);
    setTxnSort({ col: null, dir: null });
    setTxnLoading(true);
    try {
      const all = await getTransactionsByUser(uid, selectedProgramme.code);
      setTxnList(type === "all" ? all : all.filter(t => t.type === type));
    } catch {
      setTxnList([]);
    } finally {
      setTxnLoading(false);
    }
  };

  const filteredClubs = selectedCategory
    ? CLUB_CATEGORIES[selectedCategory].filter(c => c.toLowerCase().includes(clubSearch.toLowerCase()))
    : [];

  const pendingCount = Object.values(accessMap).filter(r => r.status === "pending").length;
  const atLimit      = pendingCount >= MAX_PENDING_REQUESTS;

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

        {/* Approved programme shortcuts */}
        {approvedShortcuts.length > 0 && (
          <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-red-800">Program Anda</p>
              <div className="relative sm:w-72">
                <svg className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                <input
                  type="text"
                  value={shortcutSearch}
                  onChange={e => setShortcutSearch(e.target.value)}
                  placeholder="Cari kod, nama atau kelab..."
                  className="w-full rounded-xl border border-gray-200 py-2 pl-8 pr-8 text-xs outline-none focus:border-red-400 focus:ring-1 focus:ring-red-100"
                />
                {shortcutSearch && (
                  <button onClick={() => setShortcutSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            </div>

            {filteredShortcuts.length === 0 ? (
              <p className="text-sm text-gray-400">Tiada program yang sepadan dengan carian.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {filteredShortcuts.map(r => (
                  <button
                    key={r.id}
                    onClick={() => quickSelectProgramme(r)}
                    className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-left text-sm transition ${
                      selectedProgramme?.id === r.programmeId
                        ? "border-red-900 bg-red-900 text-white"
                        : "border-gray-200 bg-white text-gray-700 hover:border-red-800 hover:bg-red-50 hover:text-red-800"
                    }`}
                  >
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${
                      selectedProgramme?.id === r.programmeId ? "bg-white/20 text-white" : "bg-red-100 text-red-800"
                    }`}>
                      {r.programmeCode}
                    </span>
                    <span className="font-medium">{r.programmeName}</span>
                    <span className={`text-xs ${selectedProgramme?.id === r.programmeId ? "text-red-200" : "text-gray-400"}`}>
                      · {r.club}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Pending access requests panel */}
        {allPendingRequests.length > 0 && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
              </svg>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                Permohonan Akses Menunggu Kelulusan ({allPendingRequests.length})
              </p>
            </div>
            <div className="space-y-2">
              {allPendingRequests.map(r => (
                <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-white px-4 py-3">
                  <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-800">
                    {r.programmeCode}
                  </span>
                  <span className="text-sm font-medium text-gray-800">{r.programmeName}</span>
                  <span className="text-gray-300">•</span>
                  <span className="text-xs text-gray-500">{r.club}</span>
                  {CLUB_TO_CATEGORY[r.club] && (
                    <>
                      <span className="text-gray-300">•</span>
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {CLUB_TO_CATEGORY[r.club]}
                      </span>
                    </>
                  )}
                  <span className="ml-auto inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                    Menunggu
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-amber-600">
              Anda tidak boleh memohon program lain sehingga permohonan di atas diselesaikan.
            </p>
          </div>
        )}

        {/* Step 1 — Category */}
        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-red-800">Pilih Kategori</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategorySelect(cat)}
                className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                  selectedCategory === cat
                    ? "border-red-900 bg-red-900 text-white"
                    : "border-gray-200 bg-white text-gray-700 hover:border-red-800 hover:bg-red-50 hover:text-red-800"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Step 2 — Club */}
        {selectedCategory && (
          <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-red-800">Pilih Kelab</p>
            <div ref={clubRef} className="relative md:max-w-md">
              <input
                type="text"
                placeholder="Cari nama kelab..."
                value={clubSearch}
                onChange={(e) => {
                  setClubSearch(e.target.value);
                  setShowClubOptions(true);
                  if (selectedClub && e.target.value !== selectedClub) {
                    setSelectedClub(null);
                    setSelectedProgramme(null);
                    setSummary(EMPTY_SUMMARY);
                    if (uid) {
                      localStorage.removeItem(`sfms_club_${uid}`);
                      localStorage.removeItem(`sfms_prog_${uid}`);
                    }
                  }
                }}
                onFocus={() => setShowClubOptions(true)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
              />
              {showClubOptions && filteredClubs.length > 0 && (
                <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                  {filteredClubs.map((club) => (
                    <li
                      key={club}
                      onMouseDown={() => handleClubSelect(club)}
                      className={`cursor-pointer px-4 py-3 text-sm transition hover:bg-red-50 hover:text-red-800 ${
                        selectedClub === club ? "bg-red-50 font-semibold text-red-800" : "text-gray-700"
                      }`}
                    >
                      {club}
                    </li>
                  ))}
                </ul>
              )}
              {showClubOptions && clubSearch.length > 0 && filteredClubs.length === 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-400 shadow-lg">
                  Tiada kelab dijumpai.
                </div>
              )}
            </div>
            {selectedClub && (
              <p className="mt-2 text-xs text-gray-500">
                Dipilih: <span className="font-semibold text-red-800">{selectedClub}</span>
              </p>
            )}
          </div>
        )}

        {/* Step 3 — Programme list */}
        {selectedClub && (
          loadingProgrammes ? (
            <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm text-sm text-gray-400">
              Memuatkan program...
            </div>
          ) : programmes.length === 0 ? (
            <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
              <p className="font-semibold">Tiada program dijumpai untuk kelab ini.</p>
              <p className="mt-1">Program perlu dicipta oleh Bendahari Kelab terlebih dahulu.</p>
            </div>
          ) : (
            <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-red-800">Pilih Program</p>
                <div className="relative sm:w-64">
                  <svg className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                  </svg>
                  <input
                    type="text"
                    value={progSearch}
                    onChange={e => setProgSearch(e.target.value)}
                    placeholder="Cari kod atau nama..."
                    className="w-full rounded-xl border border-gray-200 py-2 pl-8 pr-8 text-xs outline-none focus:border-red-400 focus:ring-1 focus:ring-red-100"
                  />
                  {progSearch && (
                    <button onClick={() => setProgSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Pending limit warning */}
              {atLimit && (
                <div className="mb-3 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <span>Anda mempunyai <strong>{pendingCount}</strong> permohonan menunggu kelulusan. Sila tunggu keputusan sebelum memohon program lain.</span>
                </div>
              )}

              <div className="space-y-2">
                {filteredProgrammes.length === 0 && progSearch ? (
                  <p className="py-2 text-sm text-gray-400">Tiada program yang sepadan dengan carian.</p>
                ) : null}
                {filteredProgrammes.map((p) => {
                  const access      = accessMap[p.id];
                  const status      = access?.status ?? null;
                  const isApproved  = status === "approved";
                  const isPending   = status === "pending";
                  const isRevoked   = status === "revoked";
                  const isSelected  = selectedProgramme?.id === p.id;

                  return (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between rounded-xl border px-4 py-3 transition ${
                        isApproved
                          ? isSelected ? "border-red-900 bg-red-50" : "border-gray-200 bg-white"
                          : "border-gray-100 bg-gray-50"
                      }`}
                    >
                      <div>
                        <span className="text-sm font-semibold text-gray-800">{p.code}</span>
                        <span className="mx-2 text-gray-300">—</span>
                        <span className="text-sm text-gray-600">{p.name}</span>
                      </div>

                      <div className="ml-4 shrink-0">
                        {/* No access yet */}
                        {!status && (
                          <button
                            onClick={() => goToRequestPage(p)}
                            disabled={atLimit}
                            title={atLimit ? "Selesaikan permohonan sedia ada dahulu" : ""}
                            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:border-red-800 hover:bg-red-50 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Minta Akses
                          </button>
                        )}

                        {/* Pending */}
                        {isPending && (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                            Menunggu Kelulusan
                          </span>
                        )}

                        {/* Approved */}
                        {isApproved && (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                              Diluluskan
                            </span>
                            <button
                              onClick={() => handleProgrammeSelect(p)}
                              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                                isSelected
                                  ? "border-red-900 bg-red-900 text-white"
                                  : "border-red-800 text-red-800 hover:bg-red-50"
                              }`}
                            >
                              {isSelected ? "✓ Dipilih" : "Pilih"}
                            </button>
                          </div>
                        )}

                        {/* Revoked — can re-request via confirmation page */}
                        {isRevoked && (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-600">
                              Akses Dicabut
                            </span>
                            <button
                              onClick={() => goToRequestPage(p)}
                              disabled={atLimit}
                              title={atLimit ? "Selesaikan permohonan sedia ada dahulu" : ""}
                              className="rounded-lg border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-700 transition hover:border-red-800 hover:bg-red-50 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Minta Semula
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        )}

        {/* Financial summary */}
        {selectedProgramme && (
          <>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-red-800">
              Gambaran Kewangan — {selectedProgramme.code}
            </p>
            <div className="mb-8 grid gap-4 md:grid-cols-3">
              <button
                onClick={() => openTxnModal("income")}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm text-left transition hover:border-green-400 hover:shadow-md"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-green-600">Jumlah Pendapatan</p>
                <h2 className="mt-2 text-2xl font-bold text-gray-900">{val ?? `RM ${summary.totalIncome.toFixed(2)}`}</h2>
                <p className="mt-1.5 text-xs text-gray-400">Klik untuk lihat entri</p>
              </button>
              <button
                onClick={() => openTxnModal("expense")}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm text-left transition hover:border-red-400 hover:shadow-md"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-red-600">Jumlah Perbelanjaan</p>
                <h2 className="mt-2 text-2xl font-bold text-gray-900">{val ?? `RM ${summary.totalExpense.toFixed(2)}`}</h2>
                <p className="mt-1.5 text-xs text-gray-400">Klik untuk lihat entri</p>
              </button>
              {(() => {
                const bal    = summary.balance;
                const isRugi = bal < 0;
                return (
                  <button
                    onClick={() => openTxnModal("all")}
                    className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-sm text-left transition hover:shadow-md ${isRugi ? "hover:border-red-400" : "hover:border-blue-400"}`}
                  >
                    <p className={`text-xs font-semibold uppercase tracking-wider ${isRugi ? "text-red-600" : "text-blue-600"}`}>
                      {isRugi ? "Rugi" : "Untung"}
                    </p>
                    <h2 className={`mt-2 text-2xl font-bold ${isRugi ? "text-red-600" : "text-gray-900"}`}>
                      {val ?? `RM ${bal.toFixed(2)}`}
                    </h2>
                    <p className="mt-1.5 text-xs text-gray-400">Klik untuk lihat semua entri</p>
                  </button>
                );
              })()}
            </div>

            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-red-800">Tindakan Pantas</p>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Link to="/treasurer/add-transaction" className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-red-800 hover:shadow-md">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-800 font-bold text-xl transition group-hover:bg-red-900 group-hover:text-white">+</div>
                <h2 className="font-semibold text-gray-900">Tambah Transaksi</h2>
                <p className="mt-1 text-sm text-gray-500">Cipta rekod pendapatan atau perbelanjaan baru.</p>
              </Link>
              <Link to="/treasurer/receipts" className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-red-800 hover:shadow-md">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-800 transition group-hover:bg-red-900 group-hover:text-white">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h2 className="font-semibold text-gray-900">Senarai Resit</h2>
                <p className="mt-1 text-sm text-gray-500">Lihat semua resit perbelanjaan yang dimuat naik.</p>
              </Link>
              <Link to="/treasurer/penyata-kewangan" className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-red-800 hover:shadow-md">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-700 font-bold text-xl transition group-hover:bg-green-700 group-hover:text-white">↓</div>
                <h2 className="font-semibold text-gray-900">Penyata Kewangan</h2>
                <p className="mt-1 text-sm text-gray-500">Jana dan muat turun penyata transaksi PDF.</p>
              </Link>
              <Link to="/treasurer/borang-kewangan" className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-red-800 hover:shadow-md">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 transition group-hover:bg-blue-700 group-hover:text-white">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <h2 className="font-semibold text-gray-900">Borang Kewangan UTM</h2>
                <p className="mt-1 text-sm text-gray-500">Isi dan hantar borang kewangan UTM.</p>
              </Link>
              <Link to="/treasurer/profile" className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-red-800 hover:shadow-md">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-700 transition group-hover:bg-red-900 group-hover:text-white">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h2 className="font-semibold text-gray-900">Profil Saya</h2>
                <p className="mt-1 text-sm text-gray-500">Kemaskini nama penuh dan no. matrik anda.</p>
              </Link>
            </div>
          </>
        )}
      </div>

      {/* ── Transaction detail modal ── */}
      {txnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl">

            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  {txnModal === "income"  && "Senarai Pendapatan"}
                  {txnModal === "expense" && "Senarai Perbelanjaan"}
                  {txnModal === "all"     && "Semua Transaksi"}
                </h3>
                <p className="mt-0.5 text-xs text-gray-500">{selectedProgramme?.code} — {selectedProgramme?.name}</p>
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
                        { col: "date",     label: "Tarikh",   align: "left"  },
                        { col: "catatan",  label: "Catatan",  align: "left"  },
                        { col: "kategori", label: "Kategori", align: "left"  },
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
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-red-100">Jenis</th>
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
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sortedTxnList.map(t => (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-600">{t.date}</td>
                        <td className="px-4 py-3 text-sm text-gray-800">{t.description || <span className="text-gray-400">—</span>}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{t.category || <span className="text-gray-400">—</span>}</td>
                        {txnModal === "all" && (
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                              t.type === "income" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                            }`}>
                              {t.type === "income" ? "Pendapatan" : "Perbelanjaan"}
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer — total */}
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
          </div>
        </div>
      )}
    </div>
  );
}
