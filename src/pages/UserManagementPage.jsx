import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import PageHeader from "../components/PageHeader";
import { secondaryAuth } from "../firebase/adminAuth";
import { ALL_CLUBS, CLUB_CATEGORIES } from "../config/clubsConfig";
import {
  createUserProfile,
  getAllUsers,
  removeUserAccess,
  updateUserRole,
  updateAdvisorClubs,
} from "../services/userService";

const ROLE_META = {
  treasurer:       { label: "Bendahari",         color: "bg-blue-100 text-blue-700" },
  advisor:         { label: "Penasihat Kelab",   color: "bg-amber-100 text-amber-700" },
  admin:           { label: "Admin",             color: "bg-purple-100 text-purple-700" },
  bendahari_kelab: { label: "Bendahari Kelab",   color: "bg-teal-100 text-teal-700" },
  pegawai:         { label: "Pegawai Kewangan",  color: "bg-indigo-100 text-indigo-700" },
};

const roleBadge = (role) => {
  const base = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold";
  const meta = ROLE_META[role] ?? { color: "bg-gray-100 text-gray-700" };
  return `${base} ${meta.color}`;
};
const roleLabel = (role) => ROLE_META[role]?.label ?? role;

const USERS_PAGE_SIZE = 20;

// Flattened club/category text for a user — used for both display and search matching.
const userClubText = (item) => {
  if (item.role === "bendahari_kelab") return item.club || "";
  if (item.role === "advisor")         return (item.clubs ?? []).join(", ");
  if (item.role === "pegawai")         return item.category || "";
  return "";
};

export default function UserManagementPage() {
  const navigate = useNavigate();

  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [errorMsg, setErrorMsg]   = useState("");

  const [search, setSearch]         = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [usersPage, setUsersPage]   = useState(1);

  const [form, setForm] = useState({ email: "", password: "", role: "treasurer", club: "", clubs: [""], category: "" });
  const [showCreateConfirm, setShowCreateConfirm] = useState(false);
  const [creating, setCreating]                   = useState(false);
  const [createSuccess, setCreateSuccess]         = useState(false);

  const [editingUser, setEditingUser]   = useState(null);
  const [editRole, setEditRole]         = useState("");
  const [editClub, setEditClub]         = useState("");
  const [editClubs, setEditClubs]       = useState([""]);
  const [editCategory, setEditCategory] = useState("");
  const [editSaving, setEditSaving]     = useState(false);
  const [showSaveRoleConfirm, setShowSaveRoleConfirm] = useState(false);
  const [saveRoleSuccess, setSaveRoleSuccess]         = useState(false);

  const [removeTarget, setRemoveTarget]   = useState(null); // user being removed
  const [removing, setRemoving]           = useState(false);
  const [removeSuccess, setRemoveSuccess] = useState(false);

  const PEGAWAI_CATEGORIES = Object.keys(CLUB_CATEGORIES);

  const loadUsers = async () => {
    try { setLoading(true); setErrorMsg(""); setUsers(await getAllUsers()); }
    catch { setErrorMsg("Gagal memuatkan pengguna."); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadUsers(); }, []);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  // ── Create user ──────────────────────────────────────────────────────────────
  const handleCreateUser = (e) => {
    e.preventDefault();
    setErrorMsg("");
    if (!form.email || !form.password || !form.role) { setErrorMsg("Sila lengkapkan semua medan."); return; }
    if (form.role === "bendahari_kelab" && !form.club.trim()) { setErrorMsg("Sila masukkan nama kelab untuk Bendahari Kelab."); return; }
    if (form.role === "advisor" && form.clubs.every(c => !c.trim())) { setErrorMsg("Sila masukkan sekurang-kurangnya satu kelab untuk Penasihat Kelab."); return; }
    if (form.role === "pegawai" && !form.category) { setErrorMsg("Sila pilih kategori kelab untuk Pegawai Kewangan."); return; }
    setShowCreateConfirm(true);
  };

  const handleConfirmCreate = async () => {
    setCreating(true); setErrorMsg("");
    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, form.email, form.password);
      await createUserProfile(cred.user.uid, {
        email:    form.email,
        role:     form.role,
        club:     form.club.trim(),
        clubs:    form.clubs.map(c => c.trim()).filter(Boolean),
        category: form.category,
      });
      setForm({ email: "", password: "", role: "treasurer", club: "", clubs: [""], category: "" });
      setShowCreateConfirm(false);
      setCreateSuccess(true);
      await loadUsers();
    } catch { setErrorMsg("Gagal mencipta pengguna."); setShowCreateConfirm(false); }
    finally { setCreating(false); }
  };

  // ── Edit role modal ──────────────────────────────────────────────────────────
  const openEdit = (user) => {
    setEditingUser(user);
    setEditRole(user.role || "treasurer");
    setEditClub(user.club || "");
    setEditClubs(user.clubs?.length ? user.clubs : [""]);
    setEditCategory(user.category || "");
  };

  const handleSaveRoleClick = () => {
    if (!editingUser) return;
    if (editRole === "bendahari_kelab" && !editClub.trim()) { alert("Sila masukkan nama kelab."); return; }
    if (editRole === "advisor" && editClubs.every(c => !c.trim())) { alert("Sila masukkan sekurang-kurangnya satu kelab."); return; }
    if (editRole === "pegawai" && !editCategory) { alert("Sila pilih kategori kelab untuk Pegawai Kewangan."); return; }
    setShowSaveRoleConfirm(true);
  };

  const handleConfirmSaveRole = async () => {
    if (!editingUser) return;
    try {
      setEditSaving(true); setErrorMsg("");
      await updateUserRole(editingUser.id, editRole, {
        club:     editClub.trim(),
        clubs:    editClubs.map(c => c.trim()).filter(Boolean),
        category: editCategory,
      });
      setShowSaveRoleConfirm(false);
      setEditingUser(null);
      setSaveRoleSuccess(true);
      await loadUsers();
    } catch { setErrorMsg("Gagal mengemaskini peranan."); setShowSaveRoleConfirm(false); }
    finally { setEditSaving(false); }
  };

  const handleConfirmRemove = async () => {
    if (!removeTarget) return;
    try {
      setRemoving(true); setErrorMsg("");
      await removeUserAccess(removeTarget.id);
      setRemoveTarget(null);
      setRemoveSuccess(true);
      await loadUsers();
    } catch { setErrorMsg("Gagal membuang akses pengguna."); setRemoveTarget(null); }
    finally { setRemoving(false); }
  };

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter(item => {
      if (roleFilter && item.role !== roleFilter) return false;
      if (!q) return true;
      return item.email.toLowerCase().includes(q) || userClubText(item).toLowerCase().includes(q);
    });
  }, [users, search, roleFilter]);

  const usersTotalPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PAGE_SIZE));
  const pagedUsers = filteredUsers.slice((usersPage - 1) * USERS_PAGE_SIZE, usersPage * USERS_PAGE_SIZE);

  useEffect(() => {
    setUsersPage(1);
  }, [search, roleFilter]);

  useEffect(() => {
    if (usersPage > usersTotalPages) setUsersPage(usersTotalPages);
  }, [usersPage, usersTotalPages]);

  const inputClass = "w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100";

  // ── Club list editor (for advisors) ─────────────────────────────────────────
  const ClubListEditor = ({ clubs, onChange, inputCls }) => (
    <div className="space-y-2">
      {clubs.map((c, i) => (
        <div key={i} className="flex gap-2 items-center">
          <select
            value={c}
            onChange={e => { const n=[...clubs]; n[i]=e.target.value; onChange(n); }}
            className={inputCls}
          >
            <option value="">-- Pilih Kelab {i+1} --</option>
            {ALL_CLUBS.map(club => <option key={club} value={club}>{club}</option>)}
          </select>
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
                <option value="pegawai">Pegawai Kewangan</option>
                <option value="advisor">Penasihat Kelab</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {form.role === "bendahari_kelab" && (
              <select name="club" value={form.club} onChange={handleChange} className={inputClass}>
                <option value="">-- Pilih Kelab --</option>
                {ALL_CLUBS.map(club => <option key={club} value={club}>{club}</option>)}
              </select>
            )}
            {form.role === "advisor" && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600">Kelab Yang Dipertanggungjawabkan</label>
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700 mb-2">
                  Penasihat Kelab dipertanggungjawabkan ke atas <strong>satu kelab</strong> secara lalai. Kelab tambahan memerlukan kelulusan admin.
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
        </div>

        {/* Jadual pengguna */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-red-100 px-6 py-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-red-700">Pengguna Berdaftar</h2>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Cari e-mel atau kelab..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-100"
                />
              </div>
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-100 sm:w-56"
              >
                <option value="">Semua Peranan</option>
                {Object.entries(ROLE_META).map(([value, meta]) => (
                  <option key={value} value={value}>{meta.label}</option>
                ))}
              </select>
            </div>
          </div>
          {loading ? (
            <p className="p-6 text-sm text-gray-500">Memuatkan pengguna...</p>
          ) : users.length === 0 ? (
            <p className="p-6 text-sm text-gray-500">Tiada pengguna dijumpai.</p>
          ) : filteredUsers.length === 0 ? (
            <p className="p-6 text-sm text-gray-500">Tiada pengguna sepadan dengan carian / penapis.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-red-900 text-left">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-red-100">E-mel</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-red-100">Peranan</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-red-100">Kelab</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-red-100">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-50">
                  {pagedUsers.map((item) => (
                    <tr key={item.id} className="hover:bg-red-50 transition-colors">
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
                          <button onClick={() => setRemoveTarget(item)} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700">
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
          {!loading && filteredUsers.length > 0 && usersTotalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3">
              <span className="text-xs text-gray-500">{filteredUsers.length} pengguna</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setUsersPage(p => Math.max(1, p - 1))}
                  disabled={usersPage === 1}
                  aria-label="Halaman sebelumnya"
                  className="rounded-lg border border-gray-200 bg-white p-1.5 text-gray-700 transition hover:border-red-800 hover:bg-red-50 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <span className="text-xs text-gray-500">{usersPage} / {usersTotalPages}</span>
                <button
                  onClick={() => setUsersPage(p => Math.min(usersTotalPages, p + 1))}
                  disabled={usersPage === usersTotalPages}
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
                  <option value="pegawai">Pegawai Kewangan</option>
                  <option value="advisor">Penasihat Kelab</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {editRole === "bendahari_kelab" && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-600">Nama Kelab</label>
                  <select value={editClub} onChange={e => setEditClub(e.target.value)} className={inputClass}>
                    <option value="">-- Pilih Kelab --</option>
                    {ALL_CLUBS.map(club => <option key={club} value={club}>{club}</option>)}
                  </select>
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
              <button onClick={handleSaveRoleClick} disabled={editSaving} className="flex-1 rounded-xl bg-red-900 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-60">
                {editSaving ? "Menyimpan..." : "Simpan"}
              </button>
              <button onClick={() => setEditingUser(null)} className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm save role */}
      {showSaveRoleConfirm && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <svg className="h-7 w-7 text-red-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h3 className="mb-2 text-base font-bold text-gray-900">Kemaskini Peranan Pengguna?</h3>
            <p className="mb-6 text-sm text-gray-600">
              <span className="font-semibold text-gray-800">{editingUser.email}</span> akan ditukar peranan kepada{" "}
              <span className="font-semibold text-gray-800">{ROLE_META[editRole]?.label ?? editRole}</span>.
            </p>
            {errorMsg && <p className="mb-4 text-xs text-red-600">{errorMsg}</p>}
            <div className="flex gap-3">
              <button onClick={() => setShowSaveRoleConfirm(false)} disabled={editSaving} className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50">
                Batal
              </button>
              <button onClick={handleConfirmSaveRole} disabled={editSaving} className="flex-1 rounded-xl bg-red-900 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-60">
                {editSaving ? "Menyimpan..." : "Ya, Kemaskini"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save role success */}
      {saveRoleSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="mb-2 text-base font-bold text-gray-900">Berjaya</h3>
            <p className="mb-6 text-sm text-gray-500">Peranan pengguna berjaya dikemaskini.</p>
            <button onClick={() => setSaveRoleSuccess(false)} className="w-full rounded-xl bg-red-900 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800">
              Okay
            </button>
          </div>
        </div>
      )}

      {/* Confirm remove user */}
      {removeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <svg className="h-7 w-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h3 className="mb-2 text-base font-bold text-gray-900">Buang Akses Pengguna?</h3>
            <p className="mb-6 text-sm text-gray-600">
              Akses <span className="font-semibold text-gray-800">{removeTarget.email}</span> akan dibuang dari aplikasi.
            </p>
            {errorMsg && <p className="mb-4 text-xs text-red-600">{errorMsg}</p>}
            <div className="flex gap-3">
              <button onClick={() => setRemoveTarget(null)} disabled={removing} className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50">
                Batal
              </button>
              <button onClick={handleConfirmRemove} disabled={removing} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60">
                {removing ? "Membuang..." : "Ya, Buang"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove user success */}
      {removeSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="mb-2 text-base font-bold text-gray-900">Berjaya</h3>
            <p className="mb-2 text-sm text-gray-500">Data profil pengguna berjaya dibuang.</p>
            <p className="mb-6 text-xs text-gray-400">Nota: Akaun Firebase Auth masih wujud — padam secara manual di Firebase Console jika perlu.</p>
            <button onClick={() => setRemoveSuccess(false)} className="w-full rounded-xl bg-red-900 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800">
              Okay
            </button>
          </div>
        </div>
      )}

      {/* Confirm create user */}
      {showCreateConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <svg className="h-7 w-7 text-red-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h3 className="mb-2 text-base font-bold text-gray-900">Cipta Pengguna Baru?</h3>
            <p className="mb-6 text-sm text-gray-600">
              <span className="font-semibold text-gray-800">{form.email}</span> akan dicipta sebagai{" "}
              <span className="font-semibold text-gray-800">{ROLE_META[form.role]?.label ?? form.role}</span>.
            </p>
            {errorMsg && <p className="mb-4 text-xs text-red-600">{errorMsg}</p>}
            <div className="flex gap-3">
              <button onClick={() => setShowCreateConfirm(false)} disabled={creating} className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50">
                Batal
              </button>
              <button onClick={handleConfirmCreate} disabled={creating} className="flex-1 rounded-xl bg-red-900 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-60">
                {creating ? "Mencipta..." : "Ya, Cipta"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create user success */}
      {createSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="mb-2 text-base font-bold text-gray-900">Berjaya</h3>
            <p className="mb-6 text-sm text-gray-500">Pengguna berjaya dicipta.</p>
            <button onClick={() => setCreateSuccess(false)} className="w-full rounded-xl bg-red-900 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800">
              Okay
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
