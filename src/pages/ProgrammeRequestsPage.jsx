import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getPendingProgrammesByClub, approveProgramme, rejectProgramme } from "../services/programmeService";
import PageHeader from "../components/PageHeader";

export default function ProgrammeRequestsPage() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();

  const club = userProfile?.club || "";

  const [requests, setRequests]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [errorMsg, setErrorMsg]   = useState("");
  const [message, setMessage]     = useState("");
  const [actioning, setActioning] = useState(null);

  const load = async () => {
    if (!club) { setLoading(false); return; }
    setLoading(true);
    try {
      setRequests(await getPendingProgrammesByClub(club));
    } catch {
      setErrorMsg("Gagal memuatkan permohonan.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [club]);

  const handleApprove = async (id, code) => {
    setActioning(id); setErrorMsg(""); setMessage("");
    try {
      await approveProgramme(id);
      setMessage(`Program "${code}" berjaya diluluskan.`);
      await load();
    } catch {
      setErrorMsg("Gagal meluluskan program.");
    } finally {
      setActioning(null);
    }
  };

  const handleReject = async (id, code) => {
    if (!window.confirm(`Tolak permohonan program "${code}"?`)) return;
    setActioning(id); setErrorMsg(""); setMessage("");
    try {
      await rejectProgramme(id);
      setMessage(`Permohonan "${code}" telah ditolak.`);
      await load();
    } catch {
      setErrorMsg("Gagal menolak permohonan.");
    } finally {
      setActioning(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Permohonan Program Baharu"
        subtitle={club ? `Kelab: ${club}` : ""}
        action={
          <button
            onClick={() => navigate(-1)}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-red-900 hover:border-red-900 hover:text-white"
          >
            Kembali
          </button>
        }
      />

      <div className="mx-auto max-w-5xl space-y-5 p-6">

        {!club && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-700">
            Akaun anda belum ditetapkan kelab. Sila hubungi pentadbir.
          </div>
        )}

        {errorMsg && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMsg}</div>
        )}
        {message && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>
        )}

        {club && (
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-purple-100 px-6 py-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-purple-700">
                Permohonan Menunggu Kelulusan
              </h2>
              <span className="text-xs text-gray-500">{requests.length} permohonan</span>
            </div>

            {loading ? (
              <p className="p-6 text-sm text-gray-500">Memuatkan permohonan...</p>
            ) : requests.length === 0 ? (
              <p className="p-6 text-sm text-gray-500">Tiada permohonan program baharu.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-red-900 text-left">
                      {["Tarikh Mohon", "Kod Program", "Nama Program", "Diminta Oleh", "Tindakan"].map((h) => (
                        <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-red-100">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {requests.map((req) => (
                      <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {req.createdAt?.toDate
                            ? req.createdAt.toDate().toLocaleDateString("ms-MY")
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-800">
                            {req.code}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{req.name}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{req.requestedByEmail || "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApprove(req.id, req.code)}
                              disabled={actioning === req.id}
                              className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
                            >
                              {actioning === req.id ? "..." : "Lulus"}
                            </button>
                            <button
                              onClick={() => handleReject(req.id, req.code)}
                              disabled={actioning === req.id}
                              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                            >
                              Tolak
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
        )}
      </div>
    </div>
  );
}
