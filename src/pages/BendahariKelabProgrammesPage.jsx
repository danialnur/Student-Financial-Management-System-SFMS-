import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  getProgrammesByClub,
  createProgramme,
  updateProgramme,
  deleteProgramme,
  isProgrammeCodeTaken,
  isProgrammeNameTaken,
} from "../services/programmeService";
import { getAccessRequestsByClub, grantDirectAccess, revokeAccess } from "../services/programmeAccessService";
import { searchTreasurerByUsernameOrEmail } from "../services/userService";
import PageHeader from "../components/PageHeader";

const inputClass = "w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100";
const inputErr   = "w-full rounded-xl border border-red-400 bg-red-50 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100";

const fmtDate = (ts) =>
  ts?.toDate ? ts.toDate().toLocaleDateString("ms-MY", { day: "2-digit", month: "short", year: "numeric" }) : null;

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
      type="button"
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

export default function BendahariKelabProgrammesPage() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const club = userProfile?.club || "";

  const [programmes, setProgrammes] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [message, setMessage]       = useState("");
  const [errorMsg, setErrorMsg]     = useState("");

  const [form, setForm]         = useState({ code: "", name: "" });
  const [formError, setFormError] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmAdd, setConfirmAdd] = useState(null);
  const [showAddSuccess, setShowAddSuccess] = useState(false);

  const [editingId, setEditingId]   = useState(null);
  const [editForm, setEditForm]     = useState({ code: "", name: "" });
  const [editFormError, setEditFormError] = useState({});
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [confirmEdit, setConfirmEdit]       = useState(null); // { id, code, name }
  const [showEditSuccess, setShowEditSuccess] = useState(false);

  const [confirmDelete, setConfirmDelete]         = useState(null); // { id, code }
  const [showDeleteSuccess, setShowDeleteSuccess] = useState(false);

  const [confirmRevoke, setConfirmRevoke]       = useState(null); // { id, label }
  const [showRevokeSuccess, setShowRevokeSuccess] = useState(false);
  const [revokeSuccessLabel, setRevokeSuccessLabel] = useState("");

  // accessMap: { [programmeId]: [accessRecord, ...] } (approved only)
  const [accessMap, setAccessMap]         = useState({});
  const [accessRecords, setAccessRecords] = useState([]); // all access records (any status) for this club

  // Search + sort for "Program Berdaftar"
  const [search, setSearch]       = useState("");
  const [sortState, setSortState] = useState({ col: null, dir: null });

  // "Add bendahari" (grant direct access) modal state
  const [showGrantModal, setShowGrantModal]       = useState(false);
  const [grantTarget, setGrantTarget]             = useState(null);
  const [grantSearch, setGrantSearch]             = useState("");
  const [grantResults, setGrantResults]           = useState([]);
  const [grantSearching, setGrantSearching]       = useState(false);
  const [grantSearchError, setGrantSearchError]   = useState("");
  const [selectedTreasurer, setSelectedTreasurer] = useState(null);
  const [granting, setGranting]                   = useState(false);
  const [grantError, setGrantError]               = useState("");
  const [showBlockedConfirm, setShowBlockedConfirm]                     = useState(false);
  const [showAlreadyTreasurer, setShowAlreadyTreasurer]                 = useState(false);
  const [showTreasurerAlreadyApproved, setShowTreasurerAlreadyApproved] = useState(false);

  const load = async () => {
    if (!club) { setLoading(false); return; }
    setLoading(true);
    try {
      const [progs, accessList] = await Promise.all([
        getProgrammesByClub(club),
        getAccessRequestsByClub(club),
      ]);
      setProgrammes(progs);
      setAccessRecords(accessList);

      const map = {};
      progs.forEach(p => { map[p.id] = []; });
      accessList
        .filter(r => r.status === "approved")
        .forEach(r => {
          if (!map[r.programmeId]) map[r.programmeId] = [];
          map[r.programmeId].push(r);
        });
      setAccessMap(map);
    } catch (err) {
      console.error(err);
      setErrorMsg("Gagal memuatkan program.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [club]);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setMessage(""); setErrorMsg("");
    const errors = {};
    if (!form.code.trim()) errors.code = "Kod program diperlukan.";
    if (!form.name.trim()) errors.name = "Nama program diperlukan.";
    setFormError(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      setSubmitting(true);
      const [codeTaken, nameTaken] = await Promise.all([
        isProgrammeCodeTaken(form.code),
        isProgrammeNameTaken(form.name),
      ]);
      const dupErrors = {};
      if (codeTaken) dupErrors.code = `Kod "${form.code.trim().toUpperCase()}" sudah digunakan.`;
      if (nameTaken) dupErrors.name = `Nama program "${form.name.trim()}" sudah digunakan.`;
      if (Object.keys(dupErrors).length > 0) {
        setFormError(dupErrors);
        return;
      }
      setConfirmAdd({ code: form.code.trim().toUpperCase(), name: form.name.trim() });
    } catch (err) {
      console.error(err);
      setErrorMsg("Gagal menyemak program.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddConfirmed = async () => {
    if (!confirmAdd) return;
    try {
      setSubmitting(true);
      await createProgramme({ code: confirmAdd.code, name: confirmAdd.name, club, status: "approved" });
      setConfirmAdd(null);
      setForm({ code: "", name: "" });
      setShowAddSuccess(true);
      await load();
    } catch (err) {
      console.error(err);
      setConfirmAdd(null);
      setErrorMsg("Gagal menambah program.");
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (item) => {
    setEditingId(item.id);
    setEditForm({ code: item.code, name: item.name });
    setEditFormError({});
  };

  const closeEditModal = () => {
    setEditingId(null);
    setEditFormError({});
  };

  const handleEditSubmit = async () => {
    if (!editingId) return;
    setMessage(""); setErrorMsg("");
    const errors = {};
    if (!editForm.code.trim()) errors.code = "Kod program diperlukan.";
    if (!editForm.name.trim()) errors.name = "Nama program diperlukan.";
    setEditFormError(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      setEditSubmitting(true);
      const original = programmes.find(p => p.id === editingId);
      const codeChanged = original && editForm.code.trim().toUpperCase() !== (original.code ?? "").trim().toUpperCase();
      const nameChanged = original && editForm.name.trim().toLowerCase() !== (original.name ?? "").trim().toLowerCase();
      const dupErrors = {};
      if (codeChanged) {
        const taken = await isProgrammeCodeTaken(editForm.code);
        if (taken) dupErrors.code = `Kod "${editForm.code.trim().toUpperCase()}" sudah digunakan.`;
      }
      if (nameChanged) {
        const taken = await isProgrammeNameTaken(editForm.name);
        if (taken) dupErrors.name = `Nama program "${editForm.name.trim()}" sudah digunakan.`;
      }
      if (Object.keys(dupErrors).length > 0) {
        setEditFormError(dupErrors);
        return;
      }
      setConfirmEdit({ id: editingId, code: editForm.code.trim().toUpperCase(), name: editForm.name.trim() });
    } catch (err) {
      console.error(err);
      setErrorMsg("Gagal menyemak program.");
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleEditConfirmed = async () => {
    if (!confirmEdit) return;
    try {
      setEditSubmitting(true);
      await updateProgramme(confirmEdit.id, { code: confirmEdit.code, name: confirmEdit.name, club });
      setConfirmEdit(null);
      closeEditModal();
      setShowEditSuccess(true);
      await load();
    } catch (err) {
      console.error(err);
      setConfirmEdit(null);
      setErrorMsg("Gagal mengemaskini program.");
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteClick = (item) => {
    setMessage(""); setErrorMsg("");
    setConfirmDelete({ id: item.id, code: item.code });
  };

  const handleDeleteConfirmed = async () => {
    if (!confirmDelete) return;
    try {
      await deleteProgramme(confirmDelete.id);
      setConfirmDelete(null);
      setShowDeleteSuccess(true);
      await load();
    } catch (err) {
      console.error(err);
      setConfirmDelete(null);
      setErrorMsg("Gagal memadam program.");
    }
  };

  const handleRevokeClick = (record, item) => {
    setMessage(""); setErrorMsg("");
    setConfirmRevoke({ id: record.id, label: `${item.code} — ${record.treasurerUsername || record.treasurerEmail}` });
  };

  const handleRevokeConfirmed = async () => {
    if (!confirmRevoke) return;
    const label = confirmRevoke.label;
    try {
      await revokeAccess(confirmRevoke.id);
      setConfirmRevoke(null);
      setRevokeSuccessLabel(label);
      setShowRevokeSuccess(true);
      await load();
    } catch (err) {
      console.error(err);
      setConfirmRevoke(null);
      setErrorMsg("Gagal mencabut akses bendahari.");
    }
  };

  // Sort cycle: null → asc → desc → null
  const handleSort = (col) => {
    setSortState(prev => {
      if (prev.col !== col)   return { col, dir: "asc" };
      if (prev.dir === "asc") return { col, dir: "desc" };
      return { col: null, dir: null };
    });
  };

  const displayedProgrammes = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = programmes.filter(item => {
      if (!q) return true;
      if (item.code.toLowerCase().includes(q)) return true;
      if (item.name.toLowerCase().includes(q)) return true;
      return (accessMap[item.id] ?? []).some(
        r => (r.treasurerUsername || r.treasurerEmail || "").toLowerCase().includes(q)
      );
    });

    const { col, dir } = sortState;
    if (!col) return filtered;

    return [...filtered].sort((a, b) => {
      if (col === "code") {
        const cmp = a.code.localeCompare(b.code);
        return dir === "asc" ? cmp : -cmp;
      }
      if (col === "name") {
        const cmp = a.name.localeCompare(b.name);
        return dir === "asc" ? cmp : -cmp;
      }
      if (col === "bendahari") {
        const aHas = (accessMap[a.id] ?? []).length > 0 ? 1 : 0;
        const bHas = (accessMap[b.id] ?? []).length > 0 ? 1 : 0;
        return dir === "asc" ? aHas - bHas : bHas - aHas;
      }
      return 0;
    });
  }, [programmes, accessMap, search, sortState]);

  const openGrantModal = (item) => {
    setGrantTarget(item);
    setGrantSearch(""); setGrantResults([]); setGrantSearchError("");
    setSelectedTreasurer(null); setGrantError("");
    setShowBlockedConfirm(false); setShowAlreadyTreasurer(false); setShowTreasurerAlreadyApproved(false);
    setShowGrantModal(true);
  };

  const closeGrantModal = () => {
    setShowGrantModal(false);
    setGrantTarget(null);
  };

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
    if (!selectedTreasurer || !grantTarget) return;

    const existing = accessRecords.find(
      r => r.treasurerUid === selectedTreasurer.id && r.programmeId === grantTarget.id
    );

    // This treasurer already has approved access to this programme
    if (existing?.status === "approved") {
      setShowTreasurerAlreadyApproved(true);
      return;
    }

    // Another treasurer already has approved access to this programme
    const occupiedBy = accessRecords.find(
      r => r.programmeId === grantTarget.id && r.status === "approved"
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

  const handleGrant = async () => {
    if (!selectedTreasurer || !grantTarget) return;
    setGranting(true);
    setGrantError("");
    try {
      await grantDirectAccess({
        programmeId:       grantTarget.id,
        programmeCode:     grantTarget.code,
        programmeName:     grantTarget.name,
        club,
        treasurerUid:      selectedTreasurer.id,
        treasurerEmail:    selectedTreasurer.email,
        treasurerUsername: selectedTreasurer.username || "",
      });
      setMessage(`Bendahari "${selectedTreasurer.username || selectedTreasurer.email}" berjaya ditambah untuk program "${grantTarget.code}".`);
      closeGrantModal();
      await load();
    } catch {
      setGrantError("Gagal memberi akses. Sila cuba lagi.");
    } finally {
      setGranting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Pengurusan Program"
        subtitle={club ? `Kelab: ${club}` : ""}
        action={
          <button
            onClick={() => navigate(-1)}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-red-900 hover:border-red-900 hover:text-white"
          >
            Kembali
          </button>
        }
      />

      <div className="mx-auto max-w-4xl space-y-6 p-6">

        {!club && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-700">
            Akaun anda belum ditetapkan kelab. Sila hubungi pentadbir.
          </div>
        )}

        {club && (
          <>
            {/* Add programme form */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-red-800">
                Tambah Program Baru
              </h2>
              <form onSubmit={handleAddSubmit} className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Kod Program</label>
                  <input
                    type="text"
                    placeholder="cth. P001"
                    value={form.code}
                    onChange={e => { setForm(p => ({ ...p, code: e.target.value })); setFormError(p => ({ ...p, code: "" })); }}
                    className={formError.code ? inputErr : inputClass}
                  />
                  {formError.code && <p className="mt-1 text-xs text-red-600">{formError.code}</p>}
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Nama Program</label>
                  <input
                    type="text"
                    placeholder="cth. Makan Malam Tahunan 2025"
                    value={form.name}
                    onChange={e => { setForm(p => ({ ...p, name: e.target.value })); setFormError(p => ({ ...p, name: "" })); }}
                    className={formError.name ? inputErr : inputClass}
                  />
                  {formError.name && <p className="mt-1 text-xs text-red-600">{formError.name}</p>}
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-xl bg-red-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-800 disabled:opacity-60"
                  >
                    {submitting ? "Menambah..." : "Tambah Program"}
                  </button>
                </div>
              </form>

              {errorMsg && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMsg}</div>}
              {message  && <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}
            </div>

            {/* Programme list */}
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-6 py-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-red-800">Program Berdaftar</h2>
              </div>

              {!loading && programmes.length > 0 && (
                <div className="border-b border-gray-100 px-6 py-4">
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
                  {search && (
                    <p className="mt-2 text-xs text-gray-500">
                      Menunjukkan <strong className="text-gray-800">{displayedProgrammes.length}</strong> daripada{" "}
                      <strong className="text-gray-800">{programmes.length}</strong> program
                    </p>
                  )}
                </div>
              )}

              {loading ? (
                <p className="p-6 text-sm text-gray-500">Memuatkan program...</p>
              ) : programmes.length === 0 ? (
                <p className="p-6 text-sm text-gray-500">Tiada program lagi. Tambah satu di atas.</p>
              ) : displayedProgrammes.length === 0 ? (
                <p className="p-6 text-sm text-gray-500">Tiada program yang sepadan dengan carian.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-red-900 text-left">
                        {[
                          { label: "Kod",             col: "code" },
                          { label: "Nama Program",    col: "name" },
                          { label: "Bendahari Aktif", col: "bendahari" },
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
                    <tbody className="divide-y divide-gray-100">
                      {displayedProgrammes.map(item => {
                        const hasBendahari = (accessMap[item.id] ?? []).length > 0;
                        return (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-800">{item.code}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">{item.name}</td>
                          <td className="px-4 py-3">
                            {(accessMap[item.id] ?? []).length === 0 ? (
                              <span className="text-xs text-gray-400">Tiada</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {(accessMap[item.id] ?? []).map(r => (
                                  <span key={r.id} className="inline-flex items-center gap-1.5 rounded-full bg-green-100 py-0.5 pl-2 pr-1 text-xs font-medium text-green-700">
                                    {r.treasurerUsername || r.treasurerEmail}
                                    {fmtDate(r.approvedAt) && (
                                      <span className="font-normal text-green-600/70" title="Tarikh lulus">· {fmtDate(r.approvedAt)}</span>
                                    )}
                                    <button
                                      onClick={() => handleRevokeClick(r, item)}
                                      title="Cabut akses bendahari"
                                      className="rounded-full p-0.5 text-green-600 transition hover:bg-green-200 hover:text-red-700"
                                    >
                                      <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => openGrantModal(item)}
                                disabled={hasBendahari}
                                title={hasBendahari ? "Program ini sudah mempunyai bendahari aktif. Cabut akses semasa dahulu." : undefined}
                                className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition ${hasBendahari ? "bg-gray-300 cursor-not-allowed" : "bg-red-900 hover:bg-red-800"}`}
                              >
                                + Bendahari
                              </button>
                              <button
                                onClick={() => openEditModal(item)}
                                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                              >
                                Sunting
                              </button>
                              <button
                                onClick={() => handleDeleteClick(item)}
                                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                              >
                                Padam
                              </button>
                            </div>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Edit programme modal ── */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h3 className="text-base font-bold text-gray-900">Sunting Program</h3>
              <button onClick={closeEditModal} className="text-gray-400 hover:text-gray-600"><XIcon /></button>
            </div>

            <div className="space-y-4 p-6">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Kod Program</label>
                <input
                  type="text"
                  value={editForm.code}
                  onChange={e => { setEditForm(p => ({ ...p, code: e.target.value })); setEditFormError(p => ({ ...p, code: "" })); }}
                  className={editFormError.code ? inputErr : inputClass}
                />
                {editFormError.code && <p className="mt-1 text-xs text-red-600">{editFormError.code}</p>}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Nama Program</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => { setEditForm(p => ({ ...p, name: e.target.value })); setEditFormError(p => ({ ...p, name: "" })); }}
                  className={editFormError.name ? inputErr : inputClass}
                />
                {editFormError.name && <p className="mt-1 text-xs text-red-600">{editFormError.name}</p>}
              </div>
            </div>

            <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
              <button onClick={closeEditModal} disabled={editSubmitting} className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50">
                Batal
              </button>
              <button onClick={handleEditSubmit} disabled={editSubmitting} className="flex-1 rounded-xl bg-red-900 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-50">
                {editSubmitting ? "Menyemak..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm edit modal ── */}
      {confirmEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
              <svg className="h-7 w-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h3 className="mb-2 text-base font-bold text-gray-900">Sahkan Kemaskini Program?</h3>
            <p className="mb-6 text-sm text-gray-500">
              Program akan dikemaskini kepada{" "}
              <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-800">{confirmEdit.code}</span>
              <span className="mx-2 font-semibold text-gray-800">{confirmEdit.name}</span>.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmEdit(null)} disabled={editSubmitting} className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50">
                Batal
              </button>
              <button onClick={handleEditConfirmed} disabled={editSubmitting} className="flex-1 rounded-xl bg-red-900 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-50">
                {editSubmitting ? "Menyimpan..." : "Ya, Kemaskini"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit success modal ── */}
      {showEditSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="mb-2 text-base font-bold text-gray-900">Program Berjaya Dikemaskini</h3>
            <button onClick={() => setShowEditSuccess(false)} className="w-full rounded-xl bg-red-900 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800">
              Okay
            </button>
          </div>
        </div>
      )}

      {/* ── Confirm add modal ── */}
      {confirmAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
              <svg className="h-7 w-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h3 className="mb-2 text-base font-bold text-gray-900">Sahkan Tambah Program?</h3>
            <p className="mb-6 text-sm text-gray-500">
              <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-800">{confirmAdd.code}</span>
              <span className="mx-2 font-semibold text-gray-800">{confirmAdd.name}</span>
              akan ditambah ke senarai program kelab anda.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmAdd(null)} disabled={submitting} className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50">
                Batal
              </button>
              <button onClick={handleAddConfirmed} disabled={submitting} className="flex-1 rounded-xl bg-red-900 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-50">
                {submitting ? "Menambah..." : "Ya, Tambah"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add success modal ── */}
      {showAddSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="mb-2 text-base font-bold text-gray-900">Program Berjaya Ditambah</h3>
            <p className="mb-6 text-sm text-gray-500">Program baharu kini disenaraikan di bawah.</p>
            <button onClick={() => setShowAddSuccess(false)} className="w-full rounded-xl bg-red-900 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800">
              Okay
            </button>
          </div>
        </div>
      )}

      {/* ── Confirm delete modal ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <svg className="h-7 w-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="mb-2 text-base font-bold text-gray-900">Padam Program?</h3>
            <p className="mb-6 text-sm text-gray-500">
              Program <span className="font-semibold text-red-800">{confirmDelete.code}</span> akan dipadam secara kekal.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
                Batal
              </button>
              <button onClick={handleDeleteConfirmed} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700">
                Ya, Padam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete success modal ── */}
      {showDeleteSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="mb-2 text-base font-bold text-gray-900">Program Berjaya Dipadam</h3>
            <button onClick={() => setShowDeleteSuccess(false)} className="w-full rounded-xl bg-red-900 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800">
              Okay
            </button>
          </div>
        </div>
      )}

      {/* ── Confirm revoke bendahari modal ── */}
      {confirmRevoke && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-orange-100">
              <svg className="h-7 w-7 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <h3 className="mb-2 text-base font-bold text-gray-900">Cabut Akses Bendahari?</h3>
            <p className="mb-6 text-sm text-gray-500">
              <span className="font-semibold text-gray-800">{confirmRevoke.label}</span> akan kehilangan akses kepada program ini.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmRevoke(null)} className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
                Batal
              </button>
              <button onClick={handleRevokeConfirmed} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700">
                Ya, Cabut
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Revoke success modal ── */}
      {showRevokeSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="mb-2 text-base font-bold text-gray-900">Akses Bendahari Berjaya Dicabut</h3>
            <p className="mb-6 text-sm text-gray-500">{revokeSuccessLabel}</p>
            <button onClick={() => setShowRevokeSuccess(false)} className="w-full rounded-xl bg-red-900 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800">
              Okay
            </button>
          </div>
        </div>
      )}

      {/* ── Add bendahari (grant direct access) modal ── */}
      {showGrantModal && grantTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Tambah Bendahari</h3>
                <p className="mt-0.5 text-xs text-gray-500">
                  <span className="font-semibold text-red-800">{grantTarget.code}</span> — {grantTarget.name}
                </p>
              </div>
              <button onClick={closeGrantModal} className="text-gray-400 hover:text-gray-600"><XIcon /></button>
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

              {grantError && <p className="text-xs text-red-600">{grantError}</p>}
            </div>

            <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
              <button onClick={closeGrantModal} className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">Batal</button>
              <button
                onClick={handleGrantClick}
                disabled={!selectedTreasurer || granting}
                className="flex-1 rounded-xl bg-red-900 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-50"
              >
                {granting ? "Memberi akses..." : "Beri Akses"}
              </button>
            </div>

            {/* Treasurer already approved for this programme overlay */}
            {showTreasurerAlreadyApproved && (
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
                    <span className="font-semibold text-red-800">{grantTarget.code} — {grantTarget.name}</span>.
                  </p>
                  <button
                    onClick={() => setShowTreasurerAlreadyApproved(false)}
                    className="w-full rounded-xl bg-red-900 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800"
                  >
                    Okay
                  </button>
                </div>
              </div>
            )}

            {/* Already-has-treasurer overlay */}
            {showAlreadyTreasurer && (() => {
              const occupant = accessRecords.find(
                r => r.programmeId === grantTarget.id && r.status === "approved" && r.treasurerUid !== selectedTreasurer?.id
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
                      Program <span className="font-semibold text-red-800">{grantTarget.code} — {grantTarget.name}</span> sudah mempunyai bendahari yang diluluskan.
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

            {/* Blocked confirmation overlay (previously rejected) */}
            {showBlockedConfirm && (
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
                    <span className="font-semibold text-red-800">{grantTarget.code}</span>.
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
            )}
          </div>
        </div>
      )}
    </div>
  );
}
