// EditTransactionPage.jsx

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getTransactionById, updateTransactionFields } from "../services/transactionService";
import { getAllProgrammes } from "../services/programmeService";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/PageHeader";

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

// Per UC6: Admin can edit any transaction; a treasurer only their own;
// a bendahari_kelab only transactions created within their own club;
// advisor/pegawai have no edit rights here (view-only via the search page).
function canEditTransaction(data, { userRole, currentUser, userProfile }) {
  if (userRole === "admin") return true;
  if (userRole === "treasurer") return data.createdBy === currentUser.uid;
  if (userRole === "bendahari_kelab") return data.createdByClub === userProfile?.club;
  return false;
}

export default function EditTransactionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, userRole, userProfile } = useAuth();

  const [form, setForm] = useState({
    date: "",
    description: "",
    amount: "",
    type: "expense",
    category: "",
    programmeCode: "",
    programmeName: "",
  });

  const [programmes, setProgrammes]   = useState([]);
  const [transaction, setTransaction] = useState(null);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [errorMsg, setErrorMsg]       = useState("");
  const [message, setMessage]         = useState("");

  useEffect(() => {
    getAllProgrammes()
      .then(setProgrammes)
      .catch((err) => console.error("Failed to load programmes:", err));
  }, []);

  // Fetches the transaction by its route id, then immediately re-checks
  // authorization against the loaded data (not just the route) before
  // populating the edit form — the transaction's own createdBy/createdByClub
  // is what canEditTransaction() actually needs to decide.
  useEffect(() => {
    const loadTransaction = async () => {
      try {
        setLoading(true);
        setErrorMsg("");
        const data = await getTransactionById(id);

        if (!data) { setErrorMsg("Transaksi tidak dijumpai."); return; }
        if (!canEditTransaction(data, { userRole, currentUser, userProfile })) {
          setErrorMsg("Anda tidak dibenarkan menyunting transaksi ini.");
          return;
        }

        setTransaction(data);
        setForm({
          date:          data.date          ?? "",
          description:   data.description   ?? "",
          amount:        data.amount        ?? "",
          type:          data.type          ?? "expense",
          category:      data.category      ?? "",
          programmeCode: data.programmeCode ?? "",
          programmeName: data.programmeName ?? "",
        });
      } catch (error) {
        console.error(error);
        setErrorMsg("Gagal memuatkan transaksi.");
      } finally {
        setLoading(false);
      }
    };

    if (currentUser?.uid && userRole) loadTransaction();
  }, [id, currentUser, userRole, userProfile]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "type" ? { category: "" } : {}),
    }));
  };

  const handleProgrammeChange = (e) => {
    const selected = programmes.find((p) => p.code === e.target.value);
    setForm((prev) => ({
      ...prev,
      programmeCode: selected?.code ?? "",
      programmeName: selected?.name ?? "",
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setMessage("");

    if (!form.programmeCode)
      return setErrorMsg("Sila pilih program.");
    if (!form.date || !form.amount || !form.category)
      return setErrorMsg("Sila lengkapkan semua medan yang diperlukan.");
    if (Number(form.amount) <= 0)
      return setErrorMsg("Jumlah mestilah lebih daripada 0.");

    if (!window.confirm("Adakah anda pasti mahu mengemaskini transaksi ini?")) return;

    try {
      setSaving(true);
      await updateTransactionFields(id, {
        date:          form.date,
        description:   form.description,
        amount:        Number(form.amount),
        type:          form.type,
        category:      form.category,
        programmeCode: form.programmeCode,
        programmeName: form.programmeName,
      });
      setMessage("Transaksi berjaya dikemaskini.");
      setTimeout(() => navigate(-1), 800);
    } catch (error) {
      console.error(error);
      setErrorMsg("Gagal mengemaskini transaksi.");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Memuatkan transaksi...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Sunting Transaksi"
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
          {errorMsg && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMsg}</div>
          )}

          {transaction && !errorMsg && (
            <form onSubmit={handleSubmit} className="space-y-5">

              <div>
                <label htmlFor="edit-programme" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Program
                </label>
                <select
                  id="edit-programme"
                  value={form.programmeCode}
                  onChange={handleProgrammeChange}
                  className={inputClass}
                >
                  <option value="">— Pilih program —</option>
                  {programmes.map((p) => (
                    <option key={p.id} value={p.code}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
                {form.programmeName && (
                  <p className="mt-1 text-xs text-gray-500">Program: {form.programmeName}</p>
                )}
              </div>

              <div>
                <label htmlFor="edit-date" className="mb-1.5 block text-sm font-medium text-gray-700">Tarikh</label>
                <input id="edit-date" type="date" name="date" value={form.date} onChange={handleChange} className={inputClass} />
              </div>

              <div>
                <label htmlFor="edit-desc" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Catatan <span className="text-xs font-normal text-gray-400">(pilihan)</span>
                </label>
                <input id="edit-desc" type="text" name="description" value={form.description} onChange={handleChange} placeholder="Masukkan catatan (pilihan)" className={inputClass} />
              </div>

              <div>
                <label htmlFor="edit-amount" className="mb-1.5 block text-sm font-medium text-gray-700">Jumlah (RM)</label>
                <input id="edit-amount" type="number" name="amount" value={form.amount} onChange={handleChange} onWheel={(e) => e.target.blur()} className={inputClass} />
              </div>

              <div>
                <label htmlFor="edit-type" className="mb-1.5 block text-sm font-medium text-gray-700">Jenis</label>
                <select id="edit-type" name="type" value={form.type} onChange={handleChange} className={inputClass}>
                  <option value="expense">Perbelanjaan</option>
                  <option value="income">Pendapatan</option>
                </select>
              </div>

              <div>
                <label htmlFor="edit-category" className="mb-1.5 block text-sm font-medium text-gray-700">Kategori</label>
                <select id="edit-category" name="category" value={form.category} onChange={handleChange} className={inputClass}>
                  <option value="">— Pilih kategori —</option>
                  {(form.type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {transaction.receiptUrl && (
                <div>
                  <p className="mb-1 text-sm font-medium text-gray-700">Resit Semasa</p>
                  <a href={transaction.receiptUrl} target="_blank" rel="noreferrer"
                    className="text-sm font-medium text-red-700 underline hover:text-red-900">
                    Lihat Resit
                  </a>
                </div>
              )}

              {message && (
                <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-red-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-800 disabled:opacity-60"
              >
                {saving ? "Menyimpan..." : "Kemaskini Transaksi"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
