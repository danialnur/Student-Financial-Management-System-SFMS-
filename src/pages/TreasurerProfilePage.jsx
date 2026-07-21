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

// e.g. "012-3456789" — dash auto-inserted after the first 3 digits.
const formatPhone = (raw) => {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
};

const MATRIC_NUMBER_LENGTH = 9; // e.g. "A20EC0001"

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
  const [errorMsg, setErrorMsg]       = useState("");
  const [confirmSave, setConfirmSave] = useState(false);
  const [savedPopup, setSavedPopup]   = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    let processed = value;
    if (name === "fullName") processed = value.toUpperCase();
    if (name === "icNumber") processed = formatIcNumber(value);
    if (name === "phone")    processed = formatPhone(value);
    setForm(p => ({ ...p, [name]: processed }));
    setFieldErrors(p => ({ ...p, [name]: "" }));
  };

  const validate = () => {
    const errors = {};
    if (!form.fullName.trim())     errors.fullName     = "Nama penuh diperlukan.";
    if (!form.matricNumber.trim()) errors.matricNumber = "No. matrik diperlukan.";
    else if (form.matricNumber.trim().length !== MATRIC_NUMBER_LENGTH)
      errors.matricNumber = `No. matrik mestilah tepat ${MATRIC_NUMBER_LENGTH} aksara.`;
    if (!form.icNumber.trim())     errors.icNumber     = "No. KP diperlukan.";
    if (!form.phone.trim())        errors.phone        = "No. telefon diperlukan.";
    return errors;
  };

  const handleRequestSubmit = (e) => {
    e.preventDefault();
    setErrorMsg("");
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setConfirmSave(true);
  };

  const handleConfirmedSubmit = async () => {
    setConfirmSave(false);
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      setSaving(true);
      await updateUserProfile(currentUser.uid, form);
      await refreshProfile();
      setSavedPopup(true);
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

          <form onSubmit={handleRequestSubmit} className="space-y-4">
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
                maxLength={MATRIC_NUMBER_LENGTH}
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
                maxLength={12}
              />
              {fieldErrors.phone && <p className="mt-1 text-xs text-red-600">{fieldErrors.phone}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">E-mel</label>
              <input type="text" value={currentUser?.email ?? ""} readOnly className="w-full rounded-xl border border-gray-100 bg-gray-100 px-4 py-3 text-sm text-gray-500 cursor-not-allowed" />
              <p className="mt-1 text-xs text-gray-400">E-mel tidak boleh diubah di sini. Hubungi pentadbir jika perlu.</p>
            </div>

            {errorMsg && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMsg}</div>}

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

      {/* ── Confirm save ── */}
      {confirmSave && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
              <svg className="h-7 w-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h3 className="mb-2 text-base font-bold text-gray-900">Sahkan Perubahan Profil?</h3>
            <p className="mb-6 text-sm text-gray-500">Maklumat profil anda akan dikemaskini. Semak semula sebelum menyimpan.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmSave(false)} className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">Batal</button>
              <button onClick={handleConfirmedSubmit} disabled={saving} className="flex-1 rounded-xl bg-red-900 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-60">
                {saving ? "Menyimpan..." : "Ya, Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Save success popup — dismissed only by explicit "OK" ── */}
      {savedPopup && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75l2.25 2.25L15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="mb-2 text-base font-bold text-gray-900">Berjaya!</h3>
            <p className="mb-6 text-sm text-gray-500">Profil berjaya dikemaskini.</p>
            <button onClick={() => setSavedPopup(false)} className="w-full rounded-xl bg-red-900 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800">
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
