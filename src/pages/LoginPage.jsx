import { useEffect, useState } from "react";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import { useNavigate, Link } from "react-router-dom";
import { auth } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { getEmailByUsername } from "../services/userService";

const BAPP_LOGO =
  "https://studentaffairs.utm.my/bapp/wp-content/uploads/sites/11/2024/09/Projek-Logo-BAPP-02.png";

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

const getErrorMessage = (code) => {
  switch (code) {
    case "auth/user-not-found":         return "Tiada akaun dijumpai dengan alamat e-mel ini.";
    case "auth/wrong-password":         return "Kata laluan tidak betul. Sila cuba lagi.";
    case "auth/invalid-email":          return "Sila masukkan alamat e-mel yang sah.";
    case "auth/user-disabled":          return "Akaun ini telah dilumpuhkan. Hubungi pentadbir anda.";
    case "auth/too-many-requests":      return "Terlalu banyak cubaan gagal. Sila cuba lagi kemudian atau tetapkan semula kata laluan anda.";
    case "auth/invalid-credential":     return "E-mel atau kata laluan tidak sah. Sila cuba lagi.";
    case "auth/network-request-failed": return "Ralat rangkaian. Sila semak sambungan anda.";
    default:                            return "Log masuk gagal. Sila semak kelayakan anda.";
  }
};

export default function LoginPage() {
  const navigate = useNavigate();
  const { currentUser, userRole, userProfile, loading: authLoading } = useAuth();

  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe]   = useState(false);
  const [errorMsg, setErrorMsg]       = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading]         = useState(false);

  const [showForgotForm, setShowForgotForm]   = useState(false);
  const [resetEmail, setResetEmail]           = useState("");
  const [resetMsg, setResetMsg]               = useState("");
  const [resetError, setResetError]           = useState("");
  const [resetLoading, setResetLoading]       = useState(false);

  useEffect(() => {
    if (authLoading || !currentUser || !userRole) return;
    if (userProfile?.accountStatus && userProfile.accountStatus !== "active") {
      navigate("/menunggu-kelulusan", { replace: true });
      return;
    }
    if (userRole === "treasurer")          navigate("/treasurer/dashboard",      { replace: true });
    else if (userRole === "advisor")       navigate("/advisor/dashboard",        { replace: true });
    else if (userRole === "admin")         navigate("/admin/dashboard",          { replace: true });
    else if (userRole === "bendahari_kelab") navigate("/bendahari-kelab/dashboard", { replace: true });
    else if (userRole === "pegawai")       navigate("/pegawai/pilih-kelab",      { replace: true });
  }, [currentUser, userRole, userProfile, authLoading, navigate]);

  const validate = () => {
    const errors = {};
    if (!email.trim())
      errors.email = "Nama pengguna diperlukan.";
    else if (email.includes("@"))
      errors.email = "Sila log masuk menggunakan nama pengguna, bukan e-mel.";
    if (!password)
      errors.password = "Kata laluan diperlukan.";
    else if (password.length < 6)
      errors.password = "Kata laluan mestilah sekurang-kurangnya 6 aksara.";
    return errors;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    try {
      await setPersistence(
        auth,
        rememberMe ? browserLocalPersistence : browserSessionPersistence
      );

      const loginEmail = await getEmailByUsername(email.trim());
      if (!loginEmail) {
        setErrorMsg("Nama pengguna tidak dijumpai. Sila semak semula.");
        setLoading(false);
        return;
      }

      await signInWithEmailAndPassword(auth, loginEmail, password);
    } catch (error) {
      setErrorMsg(getErrorMessage(error.code));
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setResetMsg("");
    setResetError("");

    if (!resetEmail) {
      setResetError("Sila masukkan alamat e-mel anda.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail)) {
      setResetError("Sila masukkan alamat e-mel yang sah.");
      return;
    }

    try {
      setResetLoading(true);
      await sendPasswordResetEmail(auth, resetEmail);
      setResetMsg("Pautan tetapan semula dihantar! Sila semak e-mel anda.");
    } catch (error) {
      if (error.code === "auth/user-not-found")
        setResetError("Tiada akaun dijumpai dengan alamat e-mel ini.");
      else
        setResetError("Gagal menghantar e-mel tetapan semula. Sila cuba lagi.");
    } finally {
      setResetLoading(false);
    }
  };

  const inputBase =
    "w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none transition focus:ring-2";
  const inputNormal  = `${inputBase} border-gray-200 focus:border-red-500 focus:ring-red-100`;
  const inputInvalid = `${inputBase} border-red-400 focus:border-red-500 focus:ring-red-100 bg-red-50`;

  return (
    <div className="flex min-h-screen">
      {/* Panel branding kiri */}
      <div className="hidden lg:flex lg:w-5/12 flex-col items-center justify-between bg-gradient-to-b from-red-950 via-red-900 to-red-800 py-12 px-10">
        <div className="w-full flex justify-center">
          <div className="rounded-2xl bg-white px-8 py-5 shadow-xl">
            <img src={BAPP_LOGO} alt="BAPP UTM" className="h-56 w-auto object-contain" />
          </div>
        </div>

        <div className="text-center">
          <div className="mx-auto mb-4 h-px w-16 bg-red-600" />
          <h2 className="text-lg font-bold text-white">Sistem Pengurusan</h2>
          <h2 className="text-lg font-bold text-red-300">Kewangan Bijak</h2>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-red-400">BAPP UTM</p>
          <p className="mx-auto mt-4 max-w-xs text-sm leading-relaxed text-red-200">
            Platform khusus untuk menguruskan kewangan kelab pelajar UTM — dari penyerahan transaksi hingga kelulusan dan laporan.
          </p>
          <div className="mx-auto mt-4 h-px w-16 bg-red-600" />
        </div>

        <div className="grid w-full grid-cols-3 gap-4 text-center">
          <div className="rounded-xl bg-red-800/50 py-3">
            <p className="text-lg font-bold text-white">3</p>
            <p className="text-xs text-red-300">Peranan</p>
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
        </div>

        <div className="flex flex-1 items-center justify-center px-8 py-12">
          <div className="w-full max-w-md">

            {!showForgotForm ? (
              <>
                <h2 className="text-3xl font-bold text-gray-900">Selamat Kembali</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Log masuk ke Sistem Pengurusan Kewangan Bijak
                </p>

                <form onSubmit={handleLogin} className="mt-8 space-y-5" noValidate>
                  <div>
                    <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700">
                      Nama Pengguna
                    </label>
                    <input
                      id="email"
                      type="text"
                      placeholder="namapengguna"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => ({ ...p, email: "" })); }}
                      className={fieldErrors.email ? inputInvalid : inputNormal}
                      autoComplete="username"
                    />
                    {fieldErrors.email && (
                      <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-700">
                      Kata Laluan
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Masukkan kata laluan anda"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setFieldErrors((p) => ({ ...p, password: "" })); }}
                        className={`${fieldErrors.password ? inputInvalid : inputNormal} pr-11`}
                        autoComplete="current-password"
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
                  </div>

                  <div className="flex items-center justify-between">
                    <label htmlFor="rememberMe" className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
                      <input
                        id="rememberMe"
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 accent-red-800"
                      />
                      Ingat Saya
                    </label>
                    <button
                      type="button"
                      onClick={() => { setShowForgotForm(true); setResetEmail(email); setResetMsg(""); setResetError(""); }}
                      className="text-sm font-medium text-red-800 hover:text-red-600 hover:underline"
                    >
                      Lupa Kata Laluan?
                    </button>
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
                    {loading ? "Sedang log masuk..." : "Log Masuk"}
                  </button>

                  <p className="text-center text-sm text-gray-500">
                    Tiada akaun?{" "}
                    <Link to="/register" className="font-medium text-red-800 hover:underline">
                      Daftar Akaun
                    </Link>
                  </p>
                </form>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setShowForgotForm(false)}
                  className="mb-6 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
                >
                  ← Kembali ke Log Masuk
                </button>

                <h2 className="text-3xl font-bold text-gray-900">Tetapkan Semula Kata Laluan</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Masukkan e-mel anda dan kami akan menghantar pautan tetapan semula.
                </p>

                <form onSubmit={handleForgotPassword} className="mt-8 space-y-5" noValidate>
                  <div>
                    <label htmlFor="resetEmail" className="mb-1.5 block text-sm font-medium text-gray-700">
                      Alamat E-mel
                    </label>
                    <input
                      id="resetEmail"
                      type="email"
                      placeholder="anda@example.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className={resetError ? inputInvalid : inputNormal}
                      autoComplete="email"
                    />
                    {resetError && (
                      <p className="mt-1 text-xs text-red-600">{resetError}</p>
                    )}
                  </div>

                  {resetMsg && (
                    <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                      {resetMsg}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="w-full rounded-xl bg-red-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-800 disabled:opacity-60"
                  >
                    {resetLoading ? "Menghantar..." : "Hantar Pautan Tetapan Semula"}
                  </button>
                </form>
              </>
            )}

            <p className="mt-10 text-center text-xs text-gray-400">
              Bahagian Aktiviti & Pembangunan Pelajar · Universiti Teknologi Malaysia
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
