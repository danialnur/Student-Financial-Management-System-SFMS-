import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { requestProgrammeAccess } from "../services/programmeAccessService";
import PageHeader from "../components/PageHeader";

export default function TreasurerRequestAccessPage() {
  const { state }  = useLocation();
  const navigate   = useNavigate();
  const { currentUser, userProfile } = useAuth();

  const programme = state?.programme;
  const club      = state?.club;

  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState("");

  if (!programme || !club) {
    navigate("/treasurer/dashboard", { replace: true });
    return null;
  }

  const handleConfirm = async () => {
    setSubmitting(true);
    setError("");
    try {
      await requestProgrammeAccess({
        programmeId:       programme.id,
        programmeCode:     programme.code,
        programmeName:     programme.name,
        club,
        treasurerUid:      currentUser.uid,
        treasurerEmail:    currentUser.email ?? "",
        treasurerUsername: userProfile?.username ?? "",
      });
      navigate("/treasurer/dashboard", { replace: true });
    } catch (err) {
      if (err.message === "MAX_PENDING_EXCEEDED") {
        setError("Anda masih mempunyai permohonan yang menunggu kelulusan. Sila tunggu keputusan sebelum menghantar permohonan baharu.");
      } else if (err.message === "MAX_ATTEMPTS_EXCEEDED") {
        setError("Anda telah pernah memohon dan ditolak untuk program ini. Sila hubungi Bendahari Kelab untuk pertimbangan semula.");
      } else {
        setError(`Gagal menghantar permohonan: ${err.message ?? "ralat tidak diketahui"}.`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Pengesahan Permohonan Akses"
        action={
          <button
            onClick={() => navigate(-1)}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-red-900 hover:border-red-900 hover:text-white"
          >
            Batal
          </button>
        }
      />

      <div className="mx-auto max-w-lg space-y-5 p-6">

        {/* Programme details */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-red-800">Butiran Program</p>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Kod Program</span>
              <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-800">
                {programme.code}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Nama Program</span>
              <span className="font-medium text-gray-900">{programme.name}</span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <span className="shrink-0 text-gray-500">Kelab</span>
              <span className="text-right text-gray-700">{club}</span>
            </div>
          </div>
        </div>

        {/* Warning */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex gap-3">
            <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <div className="text-sm text-amber-800">
              <p className="mb-2 font-semibold">Sila baca sebelum meneruskan</p>
              <ul className="list-disc space-y-1.5 pl-4 text-amber-700">
                <li>
                  Setelah permohonan dihantar, anda <strong>tidak boleh memohon program lain</strong> sehingga permohonan ini diluluskan atau ditolak.
                </li>
                <li>
                  Anda hanya dibenarkan <strong>satu (1) percubaan</strong> memohon akses untuk setiap program.
                </li>
                <li>
                  Jika ditolak, sila hubungi Bendahari Kelab untuk membatalkan penolakan sebelum anda boleh memohon semula.
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={() => navigate(-1)}
            disabled={submitting}
            className="flex-1 rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="flex-1 rounded-xl bg-red-900 py-3 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-60"
          >
            {submitting ? "Menghantar..." : "Hantar Permohonan"}
          </button>
        </div>
      </div>
    </div>
  );
}
