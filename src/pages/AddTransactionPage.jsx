import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createTransaction } from "../services/transactionService";
import { uploadReceipt } from "../services/receiptService";
import { getProgrammeById } from "../services/programmeService";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/PageHeader";

const TXN_COOLDOWN_MS = 15_000;
const MAX_FILE_SIZE   = 5 * 1024 * 1024; // 5 MB

const EXPENSE_CATEGORIES = [
  "Makan/Minum",
  "Peralatan",
  "Pengangkutan",
  "Perhubungan",
  "Cenderamata",
  "Alat Tulis",
  "Lain-lain",
];

const INCOME_CATEGORIES = [
  "Peruntukan HEP",
  "Tabung Persatuan",
  "Yuran Penyertaan",
  "Penajaan",
  "Sumbangan",
  "Lain-lain",
];

export default function AddTransactionPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [form, setForm] = useState({
    date: "",
    description: "",
    amount: "",
    type: "expense",
    category: "",
    programmeCode: "",
    programmeName: "",
  });

  const [programmeId, setProgrammeId]   = useState("");
  const [receiptFiles, setReceiptFiles] = useState([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [loading, setLoading]           = useState(false);
  const [errorMsg, setErrorMsg]         = useState("");
  const [success, setSuccess]           = useState(false);

  useEffect(() => {
    if (!currentUser?.uid) return;
    const saved = localStorage.getItem(`sfms_prog_${currentUser.uid}`);
    if (saved) {
      try {
        const { id, code, name } = JSON.parse(saved);
        setProgrammeId(id || "");
        setForm((prev) => ({ ...prev, programmeCode: code, programmeName: name }));
      } catch {}
    }
  }, [currentUser?.uid]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "type" ? { category: "" } : {}),
    }));
    if (name === "type") {
      setReceiptFiles([]);
      setFileInputKey((k) => k + 1);
    }
  };

  const handleFileChange = (e) => {
    const incoming = Array.from(e.target.files || []);
    const oversized = incoming.filter((f) => f.size > MAX_FILE_SIZE);
    if (oversized.length) {
      setErrorMsg(`Fail melebihi had 5MB: ${oversized.map((f) => f.name).join(", ")}`);
      e.target.value = "";
      return;
    }
    setReceiptFiles((prev) => [...prev, ...incoming.map((file) => ({ file, noResit: "" }))]);
    setErrorMsg("");
    e.target.value = "";
  };

  const removeFile = (index) => {
    setReceiptFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleNoResitChange = (index, value) => {
    setReceiptFiles((prev) => prev.map((rf, i) => (i === index ? { ...rf, noResit: value } : rf)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (!form.programmeCode)
      return setErrorMsg("Tiada program dipilih. Sila kembali ke papan pemuka dan pilih program.");
    if (!form.date || !form.amount || !form.category)
      return setErrorMsg("Sila lengkapkan semua medan yang diperlukan.");
    if (Number(form.amount) <= 0)
      return setErrorMsg("Jumlah mestilah lebih daripada 0.");
    if (form.type === "expense" && receiptFiles.length === 0)
      return setErrorMsg("Sila muat naik sekurang-kurangnya satu resit untuk perbelanjaan.");
    if (form.type === "expense" && receiptFiles.some((rf) => !rf.noResit.trim()))
      return setErrorMsg("Sila isi No. Resit untuk setiap resit yang dimuat naik.");

    const lastKey = `sfms_last_txn_${currentUser.uid}`;
    const last = Number(localStorage.getItem(lastKey) || 0);
    const elapsed = Date.now() - last;
    if (elapsed < TXN_COOLDOWN_MS) {
      const wait = Math.ceil((TXN_COOLDOWN_MS - elapsed) / 1000);
      return setErrorMsg(`Sila tunggu ${wait} saat sebelum menghantar transaksi lagi.`);
    }

    // Always resolve the programme's CURRENT code/name from Firestore before writing —
    // the cached copy in localStorage can go stale if the programme is renamed later,
    // which would otherwise silently write transactions under an orphaned programmeCode
    // that no longer matches what the dashboard/report queries filter by.
    let liveProgrammeCode = form.programmeCode;
    let liveProgrammeName = form.programmeName;
    if (programmeId) {
      const prog = await getProgrammeById(programmeId);
      if (prog && prog.treasurerUid && prog.treasurerUid !== currentUser.uid) {
        return setErrorMsg("Anda tidak dibenarkan mengemukakan transaksi untuk program ini. Sila pilih program anda sendiri.");
      }
      if (prog) {
        liveProgrammeCode = prog.code;
        liveProgrammeName = prog.name;
      }
    }

    try {
      setLoading(true);
      localStorage.setItem(lastKey, String(Date.now()));

      let receipts = [];
      if (receiptFiles.length) {
        try {
          receipts = await Promise.all(receiptFiles.map(async (rf) => ({ ...(await uploadReceipt(rf.file, currentUser.uid)), noResit: rf.noResit.trim() })));
        } catch (uploadError) {
          console.error("Upload error:", uploadError);
          const code = uploadError?.code ?? "";
          if (code === "storage/unauthorized" || code === "storage/unknown") {
            setErrorMsg("Gagal memuat naik resit: tiada kebenaran. Sila hubungi pentadbir untuk semak tetapan Firebase Storage.");
          } else {
            setErrorMsg(`Gagal memuat naik resit: ${uploadError?.message ?? code ?? "ralat tidak diketahui"}`);
          }
          return;
        }
      }

      await createTransaction({
        ...form,
        programmeCode: liveProgrammeCode,
        programmeName: liveProgrammeName,
        amount: Number(form.amount),
        createdBy: currentUser.uid,
        createdByEmail: currentUser.email,
        createdByClub: localStorage.getItem(`sfms_club_${currentUser.uid}`) || "",
        receipts,
        receiptUrl:  receipts[0]?.receiptUrl  ?? null,
        receiptPath: receipts[0]?.receiptPath ?? null,
      });

      setSuccess(true);
    } catch (error) {
      console.error("Transaction error:", error);
      setErrorMsg(`Gagal menambah transaksi: ${error?.message ?? error?.code ?? "ralat tidak diketahui"}`);
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100";

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="Tambah Transaksi" />
        <div className="mx-auto max-w-3xl p-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-10 shadow-sm flex flex-col items-center text-center gap-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Transaksi Ditambah</h2>
              <p className="mt-1 text-sm text-gray-500">
                Transaksi anda telah direkodkan dengan jayanya.
              </p>
            </div>
            <button
              onClick={() => navigate("/treasurer/dashboard")}
              className="rounded-xl bg-red-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-800"
            >
              Kembali ke Papan Pemuka
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Tambah Transaksi"
        action={
          <button
            onClick={() => navigate(-1)}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-red-900 hover:border-red-900 hover:text-white"
          >
            Kembali
          </button>
        }
      />

      <div className="mx-auto max-w-3xl p-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">

          {form.programmeCode ? (
            <div className="mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-red-700">Program</p>
              <p className="mt-1 text-sm font-semibold text-red-900">
                {form.programmeCode} — {form.programmeName}
              </p>
            </div>
          ) : (
            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Tiada program dipilih. Sila kembali ke papan pemuka dan pilih program terlebih dahulu.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="date" className="mb-1.5 block text-sm font-medium text-gray-700">Tarikh <span className="text-red-500">*</span></label>
              <input id="date" type="date" name="date" value={form.date} onChange={handleChange} className={inputClass} />
            </div>

            <div>
              <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-gray-700">
                Catatan <span className="text-xs font-normal text-gray-400">(pilihan)</span>
              </label>
              <input
                id="description"
                type="text"
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Masukkan catatan (pilihan)"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="amount" className="mb-1.5 block text-sm font-medium text-gray-700">Jumlah (RM) <span className="text-red-500">*</span></label>
              <input
                id="amount"
                type="number"
                name="amount"
                value={form.amount}
                onChange={handleChange}
                onWheel={(e) => e.target.blur()}
                placeholder="0.00"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="type" className="mb-1.5 block text-sm font-medium text-gray-700">Jenis <span className="text-red-500">*</span></label>
              <select id="type" name="type" value={form.type} onChange={handleChange} className={inputClass}>
                <option value="expense">Perbelanjaan</option>
                <option value="income">Pendapatan</option>
              </select>
            </div>

            <div>
              <label htmlFor="category" className="mb-1.5 block text-sm font-medium text-gray-700">Kategori <span className="text-red-500">*</span></label>
              <select
                id="category"
                name="category"
                value={form.category}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="">— Pilih kategori —</option>
                {(form.type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {form.type === "expense" && (
              <div>
                <label htmlFor="receipt" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Muat Naik Resit <span className="text-red-500">*</span>
                </label>
                <input
                  key={fileInputKey}
                  id="receipt"
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={handleFileChange}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-red-100 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-red-700 hover:file:bg-red-200"
                />
                <p className="mt-1 text-xs text-gray-400">Had: 5MB setiap fail · Jenis: JPG, PNG, PDF · Boleh pilih lebih dari satu</p>
                {receiptFiles.length > 0 && (
                  <ul className="mt-2 space-y-2">
                    {receiptFiles.map((rf, i) => (
                      <li key={i} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                        <div className="flex items-center justify-between">
                          <span className="truncate max-w-xs text-xs text-gray-600">{i + 1}. {rf.file.name}</span>
                          <button
                            type="button"
                            onClick={() => removeFile(i)}
                            className="ml-2 text-xs font-bold text-red-400 hover:text-red-600"
                          >
                            ✕
                          </button>
                        </div>
                        <input
                          type="text"
                          value={rf.noResit}
                          onChange={(e) => handleNoResitChange(i, e.target.value)}
                          placeholder="No. Resit (cth. RCP-001)"
                          className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs outline-none transition focus:border-red-500 focus:ring-1 focus:ring-red-100"
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {errorMsg && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMsg}</div>
            )}

            <button
              type="submit"
              disabled={loading || !form.programmeCode}
              className="w-full rounded-xl bg-red-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-800 disabled:opacity-60"
            >
              {loading ? "Menyimpan..." : "Tambah Transaksi"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
