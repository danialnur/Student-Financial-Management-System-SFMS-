import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { updateUserProfile } from "../services/userService";
import PageHeader from "../components/PageHeader";

const formatIcNumber = (raw) => {
  const digits = raw.replace(/\D/g, "").slice(0, 12);
  if (digits.length <= 6) return digits;
  if (digits.length <= 8) return `${digits.slice(0, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`;
};

export default function TreasurerProfilePage() {
  const navigate = useNavigate();
  const { currentUser, userProfile, refreshProfile } = useAuth();

  const [form, setForm] = useState({
    fullName:     userProfile?.fullName     ?? "",
    matricNumber: userProfile?.matricNumber ?? "",
    icNumber:     userProfile?.icNumber     ?? "",
    phone:        userProfile?.phone        ?? "",
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving]           = useState(false);
  const [message, setMessage]         = useState("");
  const [errorMsg, setErrorMsg]       = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    let processed = value;
    if (name === "fullName") processed = value.toUpperCase();
    if (name === "icNumber") processed = formatIcNumber(value);
    setForm(p => ({ ...p, [name]: processed }));
    setFieldErrors(p => ({ ...p, [name]: "" }));
    setMessage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(""); setErrorMsg("");
    const errors = {};
    if (!form.fullName.trim())     errors.fullName     = "Nama penuh diperlukan.";
    if (!form.matricNumber.trim()) errors.matricNumber = "No. matrik diperlukan.";
    if (!form.icNumber.trim())     errors.icNumber     = "No. KP diperlukan.";
    if (!form.phone.trim())        errors.phone        = "No. telefon diperlukan.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      setSaving(true);
      await updateUserProfile(currentUser.uid, form);
      await refreshProfile();
      setMessage("Profil berjaya dikemaskini.");
    } catch (err) {
      console.error(err);
      setErrorMsg("Gagal mengemaskini profil. Sila cuba lagi.");
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100";
  const inputErr    = "w-full rounded-xl border border-red-400 bg-red-50 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100";
  const field = (name) => (fieldErrors[name] ? inputErr : inputClass);

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Profil Saya"
        subtitle="Kemaskini profil anda"
        action={
          <button
            onClick={() => navigate(-1)}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-red-900 hover:border-red-900 hover:text-white"
          >
            Kembali
          </button>
        }
      />

      <div className="mx-auto max-w-2xl p-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-red-800">Maklumat Peribadi</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="fullName" className="mb-1.5 block text-sm font-medium text-gray-700">
                Nama Penuh <span className="font-normal text-gray-400">(seperti dalam kad pengenalan)</span>
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                value={form.fullName}
                onChange={handleChange}
                className={field("fullName")}
                placeholder="cth. MUHAMMAD ALI BIN ABDULLAH"
              />
              {fieldErrors.fullName && <p className="mt-1 text-xs text-red-600">{fieldErrors.fullName}</p>}
            </div>

            <div>
              <label htmlFor="matricNumber" className="mb-1.5 block text-sm font-medium text-gray-700">No. Matrik</label>
              <input
                id="matricNumber"
                name="matricNumber"
                type="text"
                value={form.matricNumber}
                onChange={handleChange}
                className={field("matricNumber")}
                placeholder="cth. A20EC0001"
              />
              {fieldErrors.matricNumber && <p className="mt-1 text-xs text-red-600">{fieldErrors.matricNumber}</p>}
            </div>

            <div>
              <label htmlFor="icNumber" className="mb-1.5 block text-sm font-medium text-gray-700">No. Kad Pengenalan</label>
              <input
                id="icNumber"
                name="icNumber"
                type="text"
                value={form.icNumber}
                onChange={handleChange}
                className={field("icNumber")}
                placeholder="980101-01-1234"
                maxLength={14}
              />
              {fieldErrors.icNumber && <p className="mt-1 text-xs text-red-600">{fieldErrors.icNumber}</p>}
            </div>

            <div>
              <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-gray-700">No. Telefon</label>
              <input
                id="phone"
                name="phone"
                type="text"
                value={form.phone}
                onChange={handleChange}
                className={field("phone")}
                placeholder="012-3456789"
              />
              {fieldErrors.phone && <p className="mt-1 text-xs text-red-600">{fieldErrors.phone}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">E-mel</label>
              <input type="text" value={currentUser?.email ?? ""} readOnly className="w-full rounded-xl border border-gray-100 bg-gray-100 px-4 py-3 text-sm text-gray-500 cursor-not-allowed" />
              <p className="mt-1 text-xs text-gray-400">E-mel tidak boleh diubah di sini. Hubungi pentadbir jika perlu.</p>
            </div>

            {errorMsg && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMsg}</div>}
            {message  && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-red-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-800 disabled:opacity-60"
            >
              {saving ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
