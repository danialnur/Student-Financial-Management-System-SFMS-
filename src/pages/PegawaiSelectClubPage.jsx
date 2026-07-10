import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { CLUB_CATEGORIES } from "../config/clubsConfig";
import PageHeader from "../components/PageHeader";

export default function PegawaiSelectClubPage() {
  const navigate = useNavigate();
  const { currentUser, userProfile, selectedClub, setSelectedClub, logout } = useAuth();

  const category = userProfile?.category || "";
  const clubList = category ? (CLUB_CATEGORIES[category] ?? []) : [];

  const [choice, setChoice] = useState(selectedClub || "");

  const handleLogout = async () => { await logout(); navigate("/login"); };

  const handleConfirm = () => {
    if (!choice) return;
    setSelectedClub(choice);
    navigate("/pegawai/dashboard", { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Pilih Kelab Di Bawah Seliaan Anda"
        subtitle={category ? `Kategori: ${category}` : ""}
        action={
          <button onClick={handleLogout} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-red-900 hover:border-red-900 hover:text-white">
            Log Keluar
          </button>
        }
      />

      <div className="mx-auto max-w-2xl space-y-6 p-6">
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
          <span className="font-semibold">Log masuk sebagai: </span>{currentUser?.email}
        </div>

        {!category ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-700">
            Akaun anda belum ditetapkan kategori kelab. Sila hubungi pentadbir.
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="mb-4 text-sm text-gray-600">
              Sila pilih kelab yang ingin anda selia untuk sesi ini. Anda boleh menukar pilihan ini
              pada bila-bila masa daripada menu utama.
            </p>

            <label className="mb-1.5 block text-xs font-medium text-gray-600">Kelab</label>
            <select
              value={choice}
              onChange={(e) => setChoice(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
            >
              <option value="">-- Pilih Kelab --</option>
              {clubList.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <button
              onClick={handleConfirm}
              disabled={!choice}
              className="mt-5 w-full rounded-xl bg-red-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-800 disabled:opacity-60"
            >
              Sahkan &amp; Teruskan
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
