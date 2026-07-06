import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getAllBorangByClub } from "../services/formService";
import { FORMS_CONFIG } from "../config/formsConfig";
import PageHeader from "../components/PageHeader";

const STATUS_OPTIONS = [
  { value: "",           label: "Semua Status" },
  { value: "menunggu",   label: "Menunggu" },
  { value: "disemak",    label: "Sedang Disemak" },
  { value: "diluluskan", label: "Diluluskan" },
  { value: "ditolak",    label: "Ditolak" },
  { value: "selesai",    label: "Selesai" },
];

const statusLabel = (s) => {
  if (s === "diluluskan") return "Diluluskan";
  if (s === "ditolak")    return "Ditolak";
  if (s === "disemak")    return "Sedang Disemak";
  if (s === "selesai")    return "Selesai";
  return "Menunggu";
};

const statusBadge = (s) => {
  const base = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold";
  if (s === "diluluskan") return `${base} bg-green-100 text-green-700`;
  if (s === "ditolak")    return `${base} bg-red-100 text-red-700`;
  if (s === "disemak")    return `${base} bg-blue-100 text-blue-700`;
  if (s === "selesai")    return `${base} bg-purple-100 text-purple-700`;
  return `${base} bg-amber-100 text-amber-700`;
};

const getFieldLabel = (formType, key) => {
  const cfg = FORMS_CONFIG.find((f) => f.id === formType);
  return cfg?.fields.find((f) => f.key === key)?.label ?? key.replace(/_/g, " ");
};

const getColLabel = (formType, key) => {
  const cfg = FORMS_CONFIG.find((f) => f.id === formType);
  return cfg?.rowColumns?.find((c) => c.key === key)?.label ?? key.replace(/_/g, " ");
};

export default function BendahariBorangPage() {
  const navigate   = useNavigate();
  const { userProfile } = useAuth();

  const club = userProfile?.club || "";

  const [allForms, setAllForms]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [errorMsg, setErrorMsg]       = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter]   = useState("");
  const [viewing, setViewing]         = useState(null);

  useEffect(() => {
    if (!club) { setLoading(false); return; }
    setLoading(true);
    getAllBorangByClub(club)
      .then(setAllForms)
      .catch(() => setErrorMsg("Gagal memuatkan borang."))
      .finally(() => setLoading(false));
  }, [club]);

  const filtered = allForms.filter((item) => {
    if (statusFilter && item.status !== statusFilter) return false;
    if (typeFilter   && item.formType !== typeFilter)  return false;
    return true;
  });

  const formTypes = [...new Set(allForms.map((i) => i.formType))].sort();

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Semua Borang Kewangan"
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

      <div className="mx-auto max-w-7xl space-y-6 p-6">

        {!club ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-700">
            Akaun anda belum ditetapkan kelab. Sila hubungi pentadbir.
          </div>
        ) : (
          <>
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
              >
                <option value="">Semua Jenis Borang</option>
                {formTypes.map((t) => {
                  const cfg = FORMS_CONFIG.find((f) => f.id === t);
                  return <option key={t} value={t}>{cfg?.title ?? t}</option>;
                })}
              </select>

              <span className="flex items-center text-xs text-gray-500">
                {filtered.length} borang dijumpai
              </span>
            </div>

            {errorMsg && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMsg}</div>
            )}

            {/* Table */}
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
              {loading ? (
                <p className="p-6 text-sm text-gray-500">Memuatkan borang...</p>
              ) : filtered.length === 0 ? (
                <p className="p-6 text-sm text-gray-500">Tiada borang dijumpai.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-red-900 text-left">
                        {["Jenis Borang", "Dihantar Oleh", "Program", "Status", "Tarikh Hantar", "Surat Kelulusan", ""].map((h) => (
                          <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-red-100">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filtered.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.formName}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{item.createdByEmail}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">
                            {item.formData?.program || item.formData?.nama_program || item.formData?.aktiviti_program || <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span className={statusBadge(item.status)}>{statusLabel(item.status)}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {item.createdAt?.toDate
                              ? item.createdAt.toDate().toLocaleDateString("ms-MY")
                              : "—"}
                          </td>
                          <td className="px-4 py-3">
                            {item.suratKelulusanUrl
                              ? <a href={item.suratKelulusanUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-blue-600 underline hover:text-blue-800">Lihat</a>
                              : <span className="text-xs text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setViewing(item)}
                              className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-200"
                            >
                              Butiran
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Detail modal — read only */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <button
              onClick={() => setViewing(null)}
              className="absolute right-4 top-4 rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
            >
              ✕
            </button>
            <h3 className="mb-0.5 text-base font-bold text-gray-900">{viewing.formName}</h3>
            <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <span>{viewing.createdByEmail}</span>
              {viewing.createdByClub && <span>· {viewing.createdByClub}</span>}
              <span>· {viewing.createdAt?.toDate ? viewing.createdAt.toDate().toLocaleDateString("ms-MY") : ""}</span>
              <span className={statusBadge(viewing.status)}>{statusLabel(viewing.status)}</span>
            </div>

            {/* Form fields */}
            {viewing.formData && (
              <div className="divide-y divide-gray-100 rounded-xl border border-gray-100">
                {Object.entries(viewing.formData).map(([key, value]) => (
                  <div key={key} className="grid grid-cols-2 gap-2 px-4 py-2">
                    <span className="text-xs font-medium text-gray-500">{getFieldLabel(viewing.formType, key)}</span>
                    <span className="text-sm text-gray-800 break-words">{value || <span className="text-gray-300">—</span>}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Row data */}
            {viewing.rows && viewing.rows.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Senarai Baris</p>
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Bil</th>
                        {Object.keys(viewing.rows[0]).map((k) => (
                          <th key={k} className="px-3 py-2 text-left font-semibold text-gray-600">
                            {getColLabel(viewing.formType, k)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {viewing.rows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                          {Object.values(row).map((v, vi) => (
                            <td key={vi} className="px-3 py-2 text-gray-700">{v || "—"}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Surat Kelulusan */}
            {viewing.suratKelulusanUrl && (
              <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                <p className="mb-1 text-xs font-semibold text-blue-700">Surat Kelulusan Program</p>
                <a
                  href={viewing.suratKelulusanUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-blue-600 underline hover:text-blue-800"
                >
                  {viewing.suratKelulusanName || "Lihat Surat Kelulusan"}
                </a>
              </div>
            )}

            {/* Mandatory attachments (config.mandatoryAttachments) */}
            {(FORMS_CONFIG.find((f) => f.id === viewing.formType)?.mandatoryAttachments ?? []).map((att) => {
              const key = `${att.key}Files`;
              return viewing[key]?.length > 0 && (
                <div key={key} className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                  <p className="mb-1 text-xs font-semibold text-blue-700">{att.label}</p>
                  <div className="flex flex-col gap-1">
                    {viewing[key].map((f, i) => (
                      <a key={i} href={f.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-blue-600 underline hover:text-blue-800">
                        {f.name || `Lihat fail ${i + 1}`}
                      </a>
                    ))}
                  </div>
                </div>
              );
            })}

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setViewing(null)}
                className="rounded-xl bg-gray-100 px-6 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
