import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAllProgrammes,
  createProgramme,
  updateProgramme,
  deleteProgramme,
  isProgrammeCodeTaken,
} from "../services/programmeService";
import PageHeader from "../components/PageHeader";
import { CLUB_CATEGORIES } from "../config/clubsConfig";

const CATEGORIES = Object.keys(CLUB_CATEGORIES);

const CLUB_TO_CATEGORY = {};
Object.entries(CLUB_CATEGORIES).forEach(([cat, clubs]) => {
  clubs.forEach(c => { CLUB_TO_CATEGORY[c] = cat; });
});

const clubsForCategory = (category) =>
  category ? [...(CLUB_CATEGORIES[category] ?? [])].sort((a, b) => a.localeCompare(b)) : [];

const PROGRAMMES_PAGE_SIZE = 20;

export default function ProgrammeManagementPage() {
  const navigate = useNavigate();

  const [programmes, setProgrammes]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [errorMsg, setErrorMsg]       = useState("");
  const [programmesPage, setProgrammesPage] = useState(1);
  const [search, setSearch]                 = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const [form, setForm]               = useState({ category: "", club: "", code: "", name: "" });
  const [formError, setFormError]     = useState({});
  const [showAddConfirm, setShowAddConfirm] = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [addSuccess, setAddSuccess]   = useState(false);

  const [clubSearch, setClubSearch]       = useState("");
  const [showClubOptions, setShowClubOptions] = useState(false);
  const clubRef = useRef(null);

  const [editingId, setEditingId]         = useState(null);
  const [editForm, setEditForm]           = useState({ category: "", club: "", code: "", name: "" });
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const [editSaving, setEditSaving]       = useState(false);
  const [editSuccess, setEditSuccess]     = useState(false);

  const [deleteTarget, setDeleteTarget]   = useState(null); // { id, code }
  const [deleting, setDeleting]           = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setErrorMsg("");
      const data = await getAllProgrammes();
      // Newest-added first — the service's default (code-ascending) order stays
      // untouched for other pages (e.g. EditTransactionPage's programme picker).
      setProgrammes([...data].sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)));
    } catch (err) {
      console.error(err);
      setErrorMsg("Gagal memuatkan program.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Close club dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (clubRef.current && !clubRef.current.contains(e.target)) setShowClubOptions(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredClubOptions = useMemo(
    () => clubsForCategory(form.category).filter(c => c.toLowerCase().includes(clubSearch.toLowerCase())),
    [form.category, clubSearch]
  );

  const handleClubSelect = (club) => {
    setForm((p) => ({ ...p, club }));
    setClubSearch(club);
    setFormError((p) => ({ ...p, club: "" }));
    setShowClubOptions(false);
  };

  const filteredProgrammes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return programmes.filter((item) => {
      if (categoryFilter && CLUB_TO_CATEGORY[item.club] !== categoryFilter) return false;
      if (!q) return true;
      return (
        (item.club ?? "").toLowerCase().includes(q) ||
        (item.code ?? "").toLowerCase().includes(q) ||
        (item.name ?? "").toLowerCase().includes(q)
      );
    });
  }, [programmes, search, categoryFilter]);

  const programmesTotalPages = Math.max(1, Math.ceil(filteredProgrammes.length / PROGRAMMES_PAGE_SIZE));
  const pagedProgrammes = filteredProgrammes.slice(
    (programmesPage - 1) * PROGRAMMES_PAGE_SIZE,
    programmesPage * PROGRAMMES_PAGE_SIZE
  );

  useEffect(() => {
    setProgrammesPage(1);
  }, [search, categoryFilter]);

  useEffect(() => {
    if (programmesPage > programmesTotalPages) setProgrammesPage(programmesTotalPages);
  }, [programmesPage, programmesTotalPages]);

  const validateForm = (f) => {
    const errors = {};
    if (!f.category) errors.category = "Sila pilih kategori.";
    if (!f.club) errors.club = "Sila pilih kelab.";
    if (!f.code.trim()) errors.code = "Kod program diperlukan.";
    if (!f.name.trim()) errors.name = "Nama program diperlukan.";
    return errors;
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    const errors = validateForm(form);
    setFormError(errors);
    if (Object.keys(errors).length > 0) return;

    const taken = await isProgrammeCodeTaken(form.code);
    if (taken) {
      setFormError((p) => ({ ...p, code: `Kod "${form.code.trim().toUpperCase()}" sudah digunakan.` }));
      return;
    }
    setShowAddConfirm(true);
  };

  const handleConfirmAdd = async () => {
    try {
      setSubmitting(true); setErrorMsg("");
      await createProgramme({ ...form, status: "approved" });
      setForm({ category: "", club: "", code: "", name: "" });
      setClubSearch("");
      setShowAddConfirm(false);
      setAddSuccess(true);
      await load();
    } catch (err) {
      console.error(err);
      setErrorMsg("Gagal menambah program.");
      setShowAddConfirm(false);
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setEditForm({
      category: CLUB_TO_CATEGORY[item.club] ?? "",
      club:     item.club ?? "",
      code:     item.code,
      name:     item.name,
    });
  };

  const handleEditSaveClick = () => {
    setErrorMsg("");
    const errors = validateForm(editForm);
    if (Object.keys(errors).length > 0) { setErrorMsg("Sila lengkapkan semua medan."); return; }
    setShowEditConfirm(true);
  };

  const handleConfirmEditSave = async () => {
    if (!editingId) return;
    try {
      setEditSaving(true); setErrorMsg("");
      const original = programmes.find((p) => p.id === editingId);
      const codeChanged = original && editForm.code.trim().toUpperCase() !== (original.code ?? "").trim().toUpperCase();
      if (codeChanged) {
        const taken = await isProgrammeCodeTaken(editForm.code);
        if (taken) {
          setErrorMsg(`Kod "${editForm.code.trim().toUpperCase()}" sudah digunakan.`);
          setEditSaving(false);
          return;
        }
      }
      await updateProgramme(editingId, editForm);
      setShowEditConfirm(false);
      setEditingId(null);
      setEditSuccess(true);
      await load();
    } catch (err) {
      console.error(err);
      setErrorMsg("Gagal mengemaskini program.");
      setShowEditConfirm(false);
    } finally {
      setEditSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true); setErrorMsg("");
      await deleteProgramme(deleteTarget.id);
      setDeleteTarget(null);
      setDeleteSuccess(true);
      await load();
    } catch (err) {
      console.error(err);
      setErrorMsg("Gagal memadam program.");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100";
  const inputErr =
    "w-full rounded-xl border border-red-400 bg-red-50 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100";

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Pengurusan Program"
        subtitle="Urus kod program yang digunakan dalam transaksi"
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

        {/* Borang tambah program */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-red-800">
            Tambah Program Baru
          </h2>
          <form onSubmit={handleAdd} className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="prog-category" className="mb-1.5 block text-sm font-medium text-gray-700">
                Kategori
              </label>
              <select
                id="prog-category"
                value={form.category}
                onChange={(e) => {
                  const category = e.target.value;
                  setForm((p) => ({ ...p, category, club: "" }));
                  setFormError((p) => ({ ...p, category: "", club: "" }));
                  setClubSearch("");
                }}
                className={formError.category ? inputErr : inputClass}
              >
                <option value="">— Pilih kategori —</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {formError.category && <p className="mt-1 text-xs text-red-600">{formError.category}</p>}
            </div>
            <div ref={clubRef} className="relative">
              <label htmlFor="prog-club" className="mb-1.5 block text-sm font-medium text-gray-700">
                Kelab
              </label>
              <input
                id="prog-club"
                type="text"
                disabled={!form.category}
                placeholder={form.category ? "Cari nama kelab..." : "Pilih kategori dahulu"}
                value={clubSearch}
                onChange={(e) => {
                  setClubSearch(e.target.value);
                  setShowClubOptions(true);
                  if (form.club && e.target.value !== form.club) {
                    setForm((p) => ({ ...p, club: "" }));
                  }
                }}
                onFocus={() => setShowClubOptions(true)}
                className={`${formError.club ? inputErr : inputClass} disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-60`}
              />
              {showClubOptions && filteredClubOptions.length > 0 && (
                <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                  {filteredClubOptions.map((club) => (
                    <li
                      key={club}
                      onMouseDown={() => handleClubSelect(club)}
                      className={`cursor-pointer px-4 py-3 text-sm transition hover:bg-red-50 hover:text-red-800 ${
                        form.club === club ? "bg-red-50 font-semibold text-red-800" : "text-gray-700"
                      }`}
                    >
                      {club}
                    </li>
                  ))}
                </ul>
              )}
              {showClubOptions && form.category && clubSearch.length > 0 && filteredClubOptions.length === 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-400 shadow-lg">
                  Tiada kelab dijumpai.
                </div>
              )}
              {formError.club && <p className="mt-1 text-xs text-red-600">{formError.club}</p>}
            </div>
            <div>
              <label htmlFor="prog-code" className="mb-1.5 block text-sm font-medium text-gray-700">
                Kod Program
              </label>
              <input
                id="prog-code"
                type="text"
                placeholder="cth. P001"
                value={form.code}
                onChange={(e) => { setForm((p) => ({ ...p, code: e.target.value })); setFormError((p) => ({ ...p, code: "" })); }}
                className={formError.code ? inputErr : inputClass}
              />
              {formError.code && <p className="mt-1 text-xs text-red-600">{formError.code}</p>}
            </div>
            <div>
              <label htmlFor="prog-name" className="mb-1.5 block text-sm font-medium text-gray-700">
                Nama Program
              </label>
              <input
                id="prog-name"
                type="text"
                placeholder="cth. Makan Malam Tahunan 2025"
                value={form.name}
                onChange={(e) => { setForm((p) => ({ ...p, name: e.target.value })); setFormError((p) => ({ ...p, name: "" })); }}
                className={formError.name ? inputErr : inputClass}
              />
              {formError.name && <p className="mt-1 text-xs text-red-600">{formError.name}</p>}
            </div>
            <div className="flex items-end sm:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-red-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-800 disabled:opacity-60 sm:w-auto"
              >
                {submitting ? "Menambah..." : "Tambah Program"}
              </button>
            </div>
          </form>

          {errorMsg && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMsg}</div>
          )}
        </div>

        {/* Jadual program */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-6 py-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-red-800">
              Program Berdaftar
            </h2>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Cari nama kelab, kod atau nama program..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-100"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-100 sm:w-56"
              >
                <option value="">Semua Kategori</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {loading ? (
            <p className="p-6 text-sm text-gray-500">Memuatkan program...</p>
          ) : programmes.length === 0 ? (
            <p className="p-6 text-sm text-gray-500">Tiada program dijumpai. Tambah satu di atas.</p>
          ) : filteredProgrammes.length === 0 ? (
            <p className="p-6 text-sm text-gray-500">Tiada program sepadan dengan carian / penapis.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-red-900 text-left">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-red-100">Kelab</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-red-100">Kod</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-red-100">Nama Program</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-red-100">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pagedProgrammes.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      {editingId === item.id ? (
                        <>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1.5">
                              <select
                                value={editForm.category}
                                onChange={(e) => setEditForm((p) => ({ ...p, category: e.target.value, club: "" }))}
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-red-500"
                              >
                                <option value="">— Kategori —</option>
                                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                              </select>
                              <select
                                value={editForm.club}
                                disabled={!editForm.category}
                                onChange={(e) => setEditForm((p) => ({ ...p, club: e.target.value }))}
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-red-500 disabled:cursor-not-allowed disabled:bg-gray-100"
                              >
                                <option value="">— Kelab —</option>
                                {clubsForCategory(editForm.category).map((c) => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <input
                              value={editForm.code}
                              onChange={(e) => setEditForm((p) => ({ ...p, code: e.target.value }))}
                              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-red-500"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              value={editForm.name}
                              onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-red-500"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button
                                onClick={handleEditSaveClick}
                                className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
                              >
                                Simpan
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="rounded-lg bg-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-300"
                              >
                                Batal
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 text-sm text-gray-700">{item.club || <span className="text-gray-400">—</span>}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-800">
                              {item.code}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">{item.name}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button
                                onClick={() => openEdit(item)}
                                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                              >
                                Sunting
                              </button>
                              <button
                                onClick={() => setDeleteTarget({ id: item.id, code: item.code })}
                                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                              >
                                Padam
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && filteredProgrammes.length > 0 && programmesTotalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3">
              <span className="text-xs text-gray-500">{filteredProgrammes.length} program</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setProgrammesPage(p => Math.max(1, p - 1))}
                  disabled={programmesPage === 1}
                  aria-label="Halaman sebelumnya"
                  className="rounded-lg border border-gray-200 bg-white p-1.5 text-gray-700 transition hover:border-red-800 hover:bg-red-50 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <span className="text-xs text-gray-500">{programmesPage} / {programmesTotalPages}</span>
                <button
                  onClick={() => setProgrammesPage(p => Math.min(programmesTotalPages, p + 1))}
                  disabled={programmesPage === programmesTotalPages}
                  aria-label="Halaman seterusnya"
                  className="rounded-lg border border-gray-200 bg-white p-1.5 text-gray-700 transition hover:border-red-800 hover:bg-red-50 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirm add programme */}
      {showAddConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <svg className="h-7 w-7 text-red-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h3 className="mb-2 text-base font-bold text-gray-900">Tambah Program Baru?</h3>
            <p className="mb-6 text-sm text-gray-600">
              <span className="font-semibold text-gray-800">{form.code.trim().toUpperCase()} — {form.name}</span>
              <br />akan didaftarkan di bawah <span className="font-semibold text-gray-800">{form.club}</span>.
            </p>
            {errorMsg && <p className="mb-4 text-xs text-red-600">{errorMsg}</p>}
            <div className="flex gap-3">
              <button onClick={() => setShowAddConfirm(false)} disabled={submitting} className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50">
                Batal
              </button>
              <button onClick={handleConfirmAdd} disabled={submitting} className="flex-1 rounded-xl bg-red-900 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-60">
                {submitting ? "Menambah..." : "Ya, Tambah"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add success */}
      {addSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="mb-2 text-base font-bold text-gray-900">Berjaya</h3>
            <p className="mb-6 text-sm text-gray-500">Program berjaya ditambah.</p>
            <button onClick={() => setAddSuccess(false)} className="w-full rounded-xl bg-red-900 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800">
              Okay
            </button>
          </div>
        </div>
      )}

      {/* Confirm edit save */}
      {showEditConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <svg className="h-7 w-7 text-red-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h3 className="mb-2 text-base font-bold text-gray-900">Kemaskini Program?</h3>
            <p className="mb-6 text-sm text-gray-600">
              <span className="font-semibold text-gray-800">{editForm.code.trim().toUpperCase()} — {editForm.name}</span>
              <br />akan dikemaskini di bawah <span className="font-semibold text-gray-800">{editForm.club}</span>.
            </p>
            {errorMsg && <p className="mb-4 text-xs text-red-600">{errorMsg}</p>}
            <div className="flex gap-3">
              <button onClick={() => setShowEditConfirm(false)} disabled={editSaving} className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50">
                Batal
              </button>
              <button onClick={handleConfirmEditSave} disabled={editSaving} className="flex-1 rounded-xl bg-red-900 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-60">
                {editSaving ? "Menyimpan..." : "Ya, Kemaskini"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit success */}
      {editSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="mb-2 text-base font-bold text-gray-900">Berjaya</h3>
            <p className="mb-6 text-sm text-gray-500">Program berjaya dikemaskini.</p>
            <button onClick={() => setEditSuccess(false)} className="w-full rounded-xl bg-red-900 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800">
              Okay
            </button>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <svg className="h-7 w-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h3 className="mb-2 text-base font-bold text-gray-900">Padam Program?</h3>
            <p className="mb-6 text-sm text-gray-600">
              Program <span className="font-semibold text-gray-800">{deleteTarget.code}</span> akan dipadam. Ini tidak akan menjejaskan transaksi sedia ada.
            </p>
            {errorMsg && <p className="mb-4 text-xs text-red-600">{errorMsg}</p>}
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50">
                Batal
              </button>
              <button onClick={handleConfirmDelete} disabled={deleting} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60">
                {deleting ? "Memadam..." : "Ya, Padam"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete success */}
      {deleteSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="mb-2 text-base font-bold text-gray-900">Berjaya</h3>
            <p className="mb-6 text-sm text-gray-500">Program berjaya dipadam.</p>
            <button onClick={() => setDeleteSuccess(false)} className="w-full rounded-xl bg-red-900 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800">
              Okay
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
