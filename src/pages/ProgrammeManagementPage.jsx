import { useEffect, useState } from "react";
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

const CLUBS = Object.values(CLUB_CATEGORIES).flat().sort();

export default function ProgrammeManagementPage() {
  const navigate = useNavigate();

  const [programmes, setProgrammes]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [errorMsg, setErrorMsg]       = useState("");
  const [message, setMessage]         = useState("");

  const [form, setForm]               = useState({ code: "", name: "", club: "" });
  const [formError, setFormError]     = useState({});
  const [submitting, setSubmitting]   = useState(false);

  const [editingId, setEditingId]     = useState(null);
  const [editForm, setEditForm]       = useState({ code: "", name: "", club: "" });

  const load = async () => {
    try {
      setLoading(true);
      setErrorMsg("");
      const data = await getAllProgrammes();
      setProgrammes(data);
    } catch (err) {
      console.error(err);
      setErrorMsg("Gagal memuatkan program.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const validateForm = (f) => {
    const errors = {};
    if (!f.code.trim()) errors.code = "Kod program diperlukan.";
    if (!f.name.trim()) errors.name = "Nama program diperlukan.";
    if (!f.club) errors.club = "Sila pilih kelab.";
    return errors;
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setMessage("");
    setErrorMsg("");
    const errors = validateForm(form);
    setFormError(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      setSubmitting(true);
      const taken = await isProgrammeCodeTaken(form.code);
      if (taken) {
        setFormError((p) => ({ ...p, code: `Kod "${form.code.trim().toUpperCase()}" sudah digunakan.` }));
        setSubmitting(false);
        return;
      }
      await createProgramme({ ...form, status: "approved" });
      setMessage("Program berjaya ditambah.");
      setForm({ code: "", name: "", club: "" });
      await load();
    } catch (err) {
      console.error(err);
      setErrorMsg("Gagal menambah program.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSave = async (id) => {
    setMessage("");
    setErrorMsg("");
    const errors = validateForm(editForm);
    if (Object.keys(errors).length > 0) { setErrorMsg("Kod dan nama kelab diperlukan."); return; }

    try {
      const original = programmes.find((p) => p.id === id);
      const codeChanged = original && editForm.code.trim().toUpperCase() !== (original.code ?? "").trim().toUpperCase();
      if (codeChanged) {
        const taken = await isProgrammeCodeTaken(editForm.code);
        if (taken) { setErrorMsg(`Kod "${editForm.code.trim().toUpperCase()}" sudah digunakan.`); return; }
      }
      await updateProgramme(id, editForm);
      setEditingId(null);
      setMessage("Program dikemaskini.");
      await load();
    } catch (err) {
      console.error(err);
      setErrorMsg("Gagal mengemaskini program.");
    }
  };

  const handleDelete = async (id, code) => {
    if (!window.confirm(`Padam program ${code}? Ini tidak akan menjejaskan transaksi sedia ada.`)) return;
    try {
      setMessage("");
      setErrorMsg("");
      await deleteProgramme(id);
      setMessage("Program dipadam.");
      await load();
    } catch (err) {
      console.error(err);
      setErrorMsg("Gagal memadam program.");
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
              <label htmlFor="prog-club" className="mb-1.5 block text-sm font-medium text-gray-700">
                Kelab
              </label>
              <select
                id="prog-club"
                value={form.club}
                onChange={(e) => { setForm((p) => ({ ...p, club: e.target.value })); setFormError((p) => ({ ...p, club: "" })); }}
                className={formError.club ? inputErr : inputClass}
              >
                <option value="">— Pilih kelab —</option>
                {CLUBS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
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

          {errorMsg && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMsg}</div>
          )}
          {message && (
            <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>
          )}
        </div>

        {/* Jadual program */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-6 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-red-800">
              Program Berdaftar
            </h2>
          </div>

          {loading ? (
            <p className="p-6 text-sm text-gray-500">Memuatkan program...</p>
          ) : programmes.length === 0 ? (
            <p className="p-6 text-sm text-gray-500">Tiada program dijumpai. Tambah satu di atas.</p>
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
                  {programmes.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      {editingId === item.id ? (
                        <>
                          <td className="px-4 py-3">
                            <select
                              value={editForm.club}
                              onChange={(e) => setEditForm((p) => ({ ...p, club: e.target.value }))}
                              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-red-500"
                            >
                              <option value="">— Pilih —</option>
                              {CLUBS.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
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
                                onClick={() => handleEditSave(item.id)}
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
                                onClick={() => { setEditingId(item.id); setEditForm({ code: item.code, name: item.name, club: item.club ?? "" }); }}
                                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                              >
                                Sunting
                              </button>
                              <button
                                onClick={() => handleDelete(item.id, item.code)}
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
        </div>
      </div>
    </div>
  );
}
