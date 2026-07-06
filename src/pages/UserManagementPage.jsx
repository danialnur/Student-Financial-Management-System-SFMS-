import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import PageHeader from "../components/PageHeader";
import { secondaryAuth } from "../firebase/adminAuth";
import {
  createUserProfile,
  getAllUsers,
  removeUserAccess,
  updateUserRole,
  updateAdvisorClubs,
} from "../services/userService";

const ROLE_META = {
  treasurer:       { label: "Bendahari",       color: "bg-blue-100 text-blue-700" },
  advisor:         { label: "Penasihat",        color: "bg-amber-100 text-amber-700" },
  admin:           { label: "Admin",            color: "bg-purple-100 text-purple-700" },
  bendahari_kelab: { label: "Bendahari Kelab",  color: "bg-teal-100 text-teal-700" },
  pegawai:         { label: "Pegawai",          color: "bg-indigo-100 text-indigo-700" },
};

const roleBadge = (role) => {
  const base = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold";
  const meta = ROLE_META[role] ?? { color: "bg-gray-100 text-gray-700" };
  return `${base} ${meta.color}`;
};
const roleLabel = (role) => ROLE_META[role]?.label ?? role;

export default function UserManagementPage() {
  const navigate = useNavigate();

  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [errorMsg, setErrorMsg]   = useState("");
  const [message, setMessage]     = useState("");

  const [form, setForm] = useState({ email: "", password: "", role: "treasurer", club: "", clubs: [""], category: "" });

  const [editingUser, setEditingUser]   = useState(null);
  const [editRole, setEditRole]         = useState("");
  const [editClub, setEditClub]         = useState("");
  const [editClubs, setEditClubs]       = useState([""]);
  const [editCategory, setEditCategory] = useState("");
  const [editSaving, setEditSaving]     = useState(false);

  const PEGAWAI_CATEGORIES = ["AKADEMIK", "BUKAN AKADEMIK", "BADAN BERUNIFORM", "ANAK NEGERI", "AGAMA", "JKM"];

  const loadUsers = async () => {
    try { setLoading(true); setErrorMsg(""); setUsers(await getAllUsers()); }
    catch { setErrorMsg("Gagal memuatkan pengguna."); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadUsers(); }, []);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  // ── Create user ──────────────────────────────────────────────────────────────
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setErrorMsg(""); setMessage("");
    if (!form.email || !form.password || !form.role) { setErrorMsg("Sila lengkapkan semua medan."); return; }
    if (form.role === "bendahari_kelab" && !form.club.trim()) { setErrorMsg("Sila masukkan nama kelab untuk Bendahari Kelab."); return; }
    if (form.role === "advisor" && form.clubs.every(c => !c.trim())) { setErrorMsg("Sila masukkan sekurang-kurangnya satu kelab untuk Penasihat."); return; }
    if (form.role === "pegawai" && !form.category) { setErrorMsg("Sila pilih kategori kelab untuk Pegawai."); return; }
    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, form.email, form.password);
      await createUserProfile(cred.user.uid, {
        email:    form.email,
        role:     form.role,
        club:     form.club.trim(),
        clubs:    form.clubs.map(c => c.trim()).filter(Boolean),
        category: form.category,
      });
      setMessage("Pengguna berjaya dicipta.");
      setForm({ email: "", password: "", role: "treasurer", club: "", clubs: [""], category: "" });
      await loadUsers();
    } catch { setErrorMsg("Gagal mencipta pengguna."); }
  };

  // ── Edit role modal ──────────────────────────────────────────────────────────
  const openEdit = (user) => {
    setEditingUser(user);
    setEditRole(user.role || "treasurer");
    setEditClub(user.club || "");
    setEditClubs(user.clubs?.length ? user.clubs : [""]);
    setEditCategory(user.category || "");
  };

  const handleSaveRole = async () => {
    if (!editingUser) return;
    if (editRole === "bendahari_kelab" && !editClub.trim()) { alert("Sila masukkan nama kelab."); return; }
    if (editRole === "advisor" && editClubs.every(c => !c.trim())) { alert("Sila masukkan sekurang-kurangnya satu kelab."); return; }
    if (editRole === "pegawai" && !editCategory) { alert("Sila pilih kategori kelab untuk Pegawai."); return; }
    try {
      setEditSaving(true); setErrorMsg(""); setMessage("");
      await updateUserRole(editingUser.id, editRole, {
        club:     editClub.trim(),
        clubs:    editClubs.map(c => c.trim()).filter(Boolean),
        category: editCategory,
      });
      setMessage("Peranan pengguna dikemaskini.");
      setEditingUser(null); await loadUsers();
    } catch { setErrorMsg("Gagal mengemaskini peranan."); }
    finally { setEditSaving(false); }
  };

  const handleRemoveAccess = async (uid) => {
    if (!window.confirm("Buang akses pengguna ini dari aplikasi?")) return;
    try {
      setErrorMsg(""); setMessage("");
      await removeUserAccess(uid);
      setMessage("Data profil pengguna dibuang. Nota: Akaun Firebase Auth masih wujud — padam secara manual di Firebase Console jika perlu."); await loadUsers();
    } catch { setErrorMsg("Gagal membuang akses pengguna."); }
  };

  const inputClass = "w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100";

  // ── Club list editor (for advisors) ─────────────────────────────────────────
  const ClubListEditor = ({ clubs, onChange, inputCls }) => (
    <div className="space-y-2">
      {clubs.map((c, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input
            type="text" value={c}
            onChange={e => { const n=[...clubs]; n[i]=e.target.value; onChange(n); }}
            className={inputCls} placeholder={`Kelab ${i+1}`}
          />
          {clubs.length > 1 && (
            <button type="button" onClick={() => onChange(clubs.filter((_,j)=>j!==i))} className="shrink-0 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50">
              Buang
            </button>
          )}
        </div>
      ))}
      {clubs.length < 5 && (
        <button type="button" onClick={() => onChange([...clubs, ""])} className="text-xs font-medium text-red-700 underline hover:text-red-900">
          + Tambah Kelab Lain (perlu kelulusan admin)
        </button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Pengurusan Pengguna"
        action={
          <button onClick={() => navigate(-1)} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-red-900 hover:border-red-900 hover:text-white">
            Kembali
          </button>
        }
      />

      <div className="mx-auto max-w-7xl space-y-6 p-6">

        {/* Tambah pengguna */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-red-700">Tambah Pengguna Baru</h2>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <input type="email" name="email" placeholder="E-mel pengguna" value={form.email} onChange={handleChange} className={inputClass} />
              <input type="password" name="password" placeholder="Kata laluan sementara" value={form.password} onChange={handleChange} className={inputClass} />
              <select name="role" value={form.role} onChange={handleChange} className={inputClass}>
                <option value="treasurer">Bendahari</option>
                <option value="bendahari_kelab">Bendahari Kelab</option>
                <option value="pegawai">Pegawai</option>
                <option value="advisor">Penasihat</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {form.role === "bendahari_kelab" && (
              <input type="text" name="club" placeholder="Nama kelab (mesti sepadan dengan nama kelab dalam sistem)" value={form.club} onChange={handleChange} className={inputClass} />
            )}
            {form.role === "advisor" && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600">Kelab Yang Dipertanggungjawabkan</label>
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700 mb-2">
                  Penasihat dipertanggungjawabkan ke atas <strong>satu kelab</strong> secara lalai. Kelab tambahan memerlukan kelulusan admin.
                </div>
                <ClubListEditor clubs={form.clubs} onChange={clubs => setForm(p=>({...p,clubs}))} inputCls={inputClass} />
              </div>
            )}
            {form.role === "pegawai" && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600">Kategori Kelab Dipertanggungjawabkan</label>
                <select name="category" value={form.category} onChange={handleChange} className={inputClass}>
                  <option value="">-- Pilih Kategori --</option>
                  {PEGAWAI_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
            )}
            <button type="submit" className="rounded-xl bg-red-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-800">
              Tambah Pengguna
            </button>
          </form>
          {errorMsg && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMsg}</div>}
          {message  && <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}
        </div>

        {/* Jadual pengguna */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-red-100 px-6 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-red-700">Pengguna Berdaftar</h2>
          </div>
          {loading ? (
            <p className="p-6 text-sm text-gray-500">Memuatkan pengguna...</p>
          ) : users.length === 0 ? (
            <p className="p-6 text-sm text-gray-500">Tiada pengguna dijumpai.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-red-900 text-left">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-red-100">UID</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-red-100">E-mel</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-red-100">Peranan</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-red-100">Kelab</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-red-100">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-50">
                  {users.map((item) => (
                    <tr key={item.id} className="hover:bg-red-50 transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-400">{item.id}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{item.email}</td>
                      <td className="px-4 py-3"><span className={roleBadge(item.role)}>{roleLabel(item.role)}</span></td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {item.role === "bendahari_kelab" && (item.club || <span className="text-gray-300">—</span>)}
                        {item.role === "advisor" && (
                          item.clubs?.length
                            ? <span>{item.clubs.join(", ")}</span>
                            : <span className="text-gray-300">—</span>
                        )}
                        {item.role === "pegawai" && (
                          item.category
                            ? <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">{item.category}</span>
                            : <span className="text-gray-300">—</span>
                        )}
                        {item.role !== "bendahari_kelab" && item.role !== "advisor" && item.role !== "pegawai" && <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => openEdit(item)} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700">
                            Tukar Peranan
                          </button>
                          <button onClick={() => handleRemoveAccess(item.id)} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700">
                            Buang
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

      {/* Modal tukar peranan */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="mb-1 text-base font-bold text-gray-900">Tukar Peranan Pengguna</h3>
            <p className="mb-5 text-xs text-gray-500">{editingUser.email}</p>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600">Peranan Baru</label>
                <select value={editRole} onChange={e => setEditRole(e.target.value)} className={inputClass}>
                  <option value="treasurer">Bendahari</option>
                  <option value="bendahari_kelab">Bendahari Kelab</option>
                  <option value="pegawai">Pegawai</option>
                  <option value="advisor">Penasihat</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {editRole === "bendahari_kelab" && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-600">Nama Kelab</label>
                  <input type="text" value={editClub} onChange={e => setEditClub(e.target.value)} className={inputClass} placeholder="Nama kelab (mesti sepadan)" />
                </div>
              )}
              {editRole === "advisor" && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-600">Kelab Yang Dipertanggungjawabkan</label>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 mb-2">
                    Satu kelab secara lalai. Kelab tambahan = kelulusan admin (anda, sebagai admin, boleh menambah di sini).
                  </div>
                  <ClubListEditor clubs={editClubs} onChange={setEditClubs} inputCls={inputClass} />
                </div>
              )}
              {editRole === "pegawai" && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-600">Kategori Kelab Dipertanggungjawabkan</label>
                  <select value={editCategory} onChange={e => setEditCategory(e.target.value)} className={inputClass}>
                    <option value="">-- Pilih Kategori --</option>
                    {PEGAWAI_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={handleSaveRole} disabled={editSaving} className="flex-1 rounded-xl bg-red-900 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-60">
                {editSaving ? "Menyimpan..." : "Simpan"}
              </button>
              <button onClick={() => setEditingUser(null)} className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
