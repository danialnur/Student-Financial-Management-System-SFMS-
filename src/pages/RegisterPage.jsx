import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { useNavigate, Link } from "react-router-dom";
import { auth } from "../firebase/config";
import { createUserProfile } from "../services/userService";

const BAPP_LOGO =
  "https://studentaffairs.utm.my/bapp/wp-content/uploads/sites/11/2024/09/Projek-Logo-BAPP-02.png";

const ADMIN_CONTACT = "mailto:sfms-admin@utm.my";

const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const EyeOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const PASSWORD_RULES = [
  { label: "Sekurang-kurangnya 8 aksara",            test: (p) => p.length >= 8 },
  { label: "Satu huruf besar (A–Z)",                 test: (p) => /[A-Z]/.test(p) },
  { label: "Satu huruf kecil (a–z)",                 test: (p) => /[a-z]/.test(p) },
  { label: "Satu nombor (0–9)",                      test: (p) => /\d/.test(p) },
  { label: "Satu aksara khas (!@#$%…)",              test: (p) => /[!@#$%^&*()\-_=+[\]{};:'",.<>/?\\|]/.test(p) },
];

const isPasswordStrong = (p) => PASSWORD_RULES.every((r) => r.test(p));

const getErrorMessage = (code) => {
  switch (code) {
    case "auth/email-already-in-use":   return "Akaun dengan e-mel ini sudah wujud.";
    case "auth/invalid-email":          return "Sila masukkan alamat e-mel yang sah.";
    case "auth/weak-password":          return "Kata laluan tidak memenuhi keperluan keselamatan.";
    case "auth/network-request-failed": return "Ralat rangkaian. Sila semak sambungan anda.";
    default:                            return "Pendaftaran gagal. Sila cuba lagi.";
  }
};

export default function RegisterPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    fullName:        "",
    matricNumber:    "",
    email:           "",
    password:        "",
    confirmPassword: "",
  });

  const [showPassword,        setShowPassword]        = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPasswordRules,   setShowPasswordRules]   = useState(false);
  const [fieldErrors,         setFieldErrors]         = useState({});
  const [errorMsg,            setErrorMsg]            = useState("");
  const [loading,             setLoading]             = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const processed = name === "fullName" ? value.toUpperCase() : value;
    setForm((prev) => ({ ...prev, [name]: processed }));
    setFieldErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validate = () => {
    const errors = {};

    if (!form.fullName.trim())
      errors.fullName = "Nama penuh diperlukan.";
    else if (form.fullName.trim().length < 3)
      errors.fullName = "Sila masukkan nama penuh anda.";

    if (!form.matricNumber.trim())
      errors.matricNumber = "No. matrik diperlukan.";

    if (!form.email)
      errors.email = "E-mel diperlukan.";
    else if (!/^[^\s@]+@graduate\.utm\.my$/i.test(form.email))
      errors.email = "Hanya e-mel graduan UTM diterima (cth: nama@graduate.utm.my).";

    if (!form.password)
      errors.password = "Kata laluan diperlukan.";
    else if (!isPasswordStrong(form.password))
      errors.password = "Kata laluan tidak memenuhi semua keperluan di bawah.";

    if (!form.confirmPassword)
      errors.confirmPassword = "Sila sahkan kata laluan anda.";
    else if (form.password !== form.confirmPassword)
      errors.confirmPassword = "Kata laluan tidak sepadan.";

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      setLoading(true);
      const userCredential = await createUserWithEmailAndPassword(auth, form.email, form.password);
      await createUserProfile(userCredential.user.uid, {
        email:        form.email,
        role:         "treasurer",
        fullName:     form.fullName.trim().toUpperCase(),
        matricNumber: form.matricNumber.trim().toUpperCase(),
      });
      navigate("/treasurer/dashboard");
    } catch (error) {
      setErrorMsg(getErrorMessage(error.code));
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const inputBase    = "w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none transition focus:ring-2";
  const inputNormal  = `${inputBase} border-gray-200 focus:border-red-500 focus:ring-red-100`;
  const inputInvalid = `${inputBase} border-red-400 focus:border-red-500 focus:ring-red-100 bg-red-50`;

  const field = (name) => (fieldErrors[name] ? inputInvalid : inputNormal);

  return (
    <div className="flex min-h-screen">
      {/* Panel branding kiri */}
      <div className="hidden lg:flex lg:w-5/12 flex-col items-center justify-between bg-gradient-to-b from-red-950 via-red-900 to-red-800 py-12 px-10">
        <div className="w-full flex justify-center">
          <div className="rounded-2xl bg-white px-8 py-5 shadow-xl">
            <img src={BAPP_LOGO} alt="BAPP UTM" className="h-40 w-auto object-contain" />
          </div>
        </div>

        <div className="text-center">
          <div className="mx-auto mb-4 h-px w-16 bg-red-600" />
          <h2 className="text-2xl font-bold text-white">Sistem Pengurusan</h2>
          <h2 className="text-2xl font-bold text-red-300">Kewangan Bijak</h2>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-red-400">BAPP UTM</p>
          <p className="mx-auto mt-4 max-w-xs text-sm leading-relaxed text-red-200">
            Daftar dengan e-mel graduan UTM anda untuk mula menguruskan kewangan kelab anda.
          </p>
          <div className="mx-auto mt-4 h-px w-16 bg-red-600" />
        </div>

        <div className="grid w-full grid-cols-3 gap-4 text-center">
          <div className="rounded-xl bg-red-800/50 py-3">
            <p className="text-lg font-bold text-white">Percuma</p>
            <p className="text-xs text-red-300">Akses</p>
          </div>
          <div className="rounded-xl bg-red-800/50 py-3">
            <p className="text-lg font-bold text-white">UTM</p>
            <p className="text-xs text-red-300">Rasmi</p>
          </div>
          <div className="rounded-xl bg-red-800/50 py-3">
            <p className="text-lg font-bold text-white">PDF</p>
            <p className="text-xs text-red-300">Laporan</p>
          </div>
        </div>
      </div>

      {/* Panel borang kanan */}
      <div className="flex flex-1 flex-col bg-gray-50">
        <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-6 py-4 lg:hidden">
          <img src={BAPP_LOGO} alt="BAPP UTM" className="h-14 w-auto object-contain scale-[1.3]" />
          <div>
            <p className="text-xs text-gray-400">BAPP UTM</p>
            <p className="text-sm font-bold text-gray-800">Sistem Pengurusan Kewangan Bijak</p>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-8 py-10">
          <div className="w-full max-w-md">
            <h2 className="text-3xl font-bold text-gray-900">Cipta Akaun</h2>
            <p className="mt-1 text-sm text-gray-500">
              Daftar sebagai Bendahari · Sistem Pengurusan Kewangan Bijak
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>

              {/* Nama penuh */}
              <div>
                <label htmlFor="fullName" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Nama Penuh <span className="text-gray-400 font-normal">(seperti dalam kad pengenalan)</span>
                </label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  placeholder="cth. MUHAMMAD ALI BIN ABDULLAH"
                  value={form.fullName}
                  onChange={handleChange}
                  className={field("fullName")}
                  autoComplete="name"
                />
                {fieldErrors.fullName && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.fullName}</p>
                )}
              </div>

              {/* No. matrik */}
              <div>
                <label htmlFor="matricNumber" className="mb-1.5 block text-sm font-medium text-gray-700">
                  No. Matrik
                </label>
                <input
                  id="matricNumber"
                  name="matricNumber"
                  type="text"
                  placeholder="cth. A20EC0001"
                  value={form.matricNumber}
                  onChange={handleChange}
                  className={field("matricNumber")}
                  autoComplete="off"
                />
                {fieldErrors.matricNumber && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.matricNumber}</p>
                )}
              </div>

              {/* E-mel */}
              <div>
                <label htmlFor="reg-email" className="mb-1.5 block text-sm font-medium text-gray-700">
                  E-mel Graduan UTM
                </label>
                <input
                  id="reg-email"
                  name="email"
                  type="email"
                  placeholder="nama@graduate.utm.my"
                  value={form.email}
                  onChange={handleChange}
                  className={field("email")}
                  autoComplete="email"
                />
                {fieldErrors.email ? (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
                ) : (
                  <p className="mt-1 text-xs text-gray-400">Mesti berakhir dengan @graduate.utm.my</p>
                )}
              </div>

              {/* Kata laluan */}
              <div>
                <label htmlFor="reg-password" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Kata Laluan
                </label>
                <div className="relative">
                  <input
                    id="reg-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Cipta kata laluan yang kukuh"
                    value={form.password}
                    onChange={handleChange}
                    onFocus={() => setShowPasswordRules(true)}
                    className={`${field("password")} pr-11`}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={showPassword ? "Sembunyikan kata laluan" : "Tunjukkan kata laluan"}
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>
                )}

                {(showPasswordRules || form.password) && (
                  <ul className="mt-2 space-y-1 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                    {PASSWORD_RULES.map(({ label, test }) => {
                      const passed = test(form.password);
                      return (
                        <li key={label} className={`flex items-center gap-2 text-xs ${passed ? "text-green-600" : "text-gray-400"}`}>
                          <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${passed ? "bg-green-100 text-green-600" : "bg-gray-200 text-gray-400"}`}>
                            {passed ? "✓" : "○"}
                          </span>
                          {label}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* Sahkan kata laluan */}
              <div>
                <label htmlFor="reg-confirm" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Sahkan Kata Laluan
                </label>
                <div className="relative">
                  <input
                    id="reg-confirm"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Masukkan semula kata laluan anda"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    className={`${field("confirmPassword")} pr-11`}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={showConfirmPassword ? "Sembunyikan kata laluan" : "Tunjukkan kata laluan"}
                  >
                    {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
                {fieldErrors.confirmPassword && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.confirmPassword}</p>
                )}
              </div>

              {/* Notis peranan */}
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                Akaun anda akan didaftarkan sebagai <strong>Bendahari</strong>. Perlukan peranan lain?{" "}
                <a href={ADMIN_CONTACT} className="font-semibold underline hover:text-blue-900">
                  Hubungi Pentadbir
                </a>
              </div>

              {errorMsg && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-red-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-800 active:bg-red-950 disabled:opacity-60"
              >
                {loading ? "Mencipta akaun..." : "Cipta Akaun"}
              </button>

              <p className="text-center text-sm text-gray-500">
                Sudah ada akaun?{" "}
                <Link to="/login" className="font-medium text-red-800 hover:underline">
                  Log Masuk
                </Link>
              </p>
            </form>

            <p className="mt-8 text-center text-xs text-gray-400">
              Bahagian Aktiviti & Pembangunan Pelajar · Universiti Teknologi Malaysia
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
