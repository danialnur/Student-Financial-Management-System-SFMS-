import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPendingBorang, getPendingBorangByClub, getPendingBorangByClubs, getPendingCukaiFormsByCategory, PEGAWAI_ONLY_FORM_TYPES, updateBorangStatus } from "../services/formService";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/PageHeader";
import { FORMS_CONFIG } from "../config/formsConfig";

const BACK_ROUTES = {
  advisor:         "/advisor/dashboard",
  admin:           "/admin/dashboard",
  bendahari_kelab: "/bendahari-kelab/dashboard",
  pegawai:         "/pegawai/dashboard",
};

export default function ApprovalPage() {
  const navigate = useNavigate();
  const { currentUser, userRole, userProfile } = useAuth();

  const advisorClubs   = userProfile?.clubs   ?? [];
  const bkClub         = userProfile?.club    ?? "";
  const pegawaiCategory = userProfile?.category ?? "";

  const [borangList, setBorangList]         = useState([]);
  const [loadingBorang, setLoadingBorang]   = useState(true);
  const [borangError, setBorangError]       = useState("");
  const [borangActionId, setBorangActionId] = useState("");
  const [viewingBorang, setViewingBorang]   = useState(null);
  const [advisorData, setAdvisorData]       = useState({});

  const loadPendingBorang = async () => {
    try {
      setLoadingBorang(true); setBorangError("");
      let list;
      if (userRole === "bendahari_kelab") {
        list = bkClub ? await getPendingBorangByClub(bkClub) : [];
      } else if (userRole === "advisor") {
        list = advisorClubs.length ? await getPendingBorangByClubs(advisorClubs) : [];
      } else if (userRole === "pegawai") {
        // Pegawai sees everything EXCEPT pegawai-only form types, plus those
        // pegawai-only forms (e.g. tax exemption) scoped to their own category.
        const [general, cukai] = await Promise.all([
          getPendingBorang(),
          getPendingCukaiFormsByCategory(pegawaiCategory),
        ]);
        list = [...general.filter(f => !PEGAWAI_ONLY_FORM_TYPES.includes(f.formType)), ...cukai];
      } else {
        // admin — sees everything, unrestricted
        list = await getPendingBorang();
      }
      setBorangList(list);
    } catch { setBorangError("Gagal memuatkan borang menunggu."); }
    finally { setLoadingBorang(false); }
  };

  useEffect(() => {
    loadPendingBorang();
  }, [userRole, userProfile]);

  const handleBorangAction = async (id, status) => {
    try {
      setBorangActionId(id);
      const extra = Object.values(advisorData).some(v=>v) ? { advisorData } : {};
      await updateBorangStatus(id, status, { uid: currentUser.uid, email: currentUser.email }, extra);
      await loadPendingBorang();
      setViewingBorang(null); setAdvisorData({});
    } catch { setBorangError("Gagal mengemaskini status borang."); }
    finally { setBorangActionId(""); }
  };

  const handleViewBorang = async (item) => {
    setAdvisorData({});
    setViewingBorang(item);
    if (item.status === "menunggu") {
      try {
        await updateBorangStatus(item.id, "disemak", { uid: currentUser.uid, email: currentUser.email });
        setBorangList(prev => prev.map(b => b.id === item.id ? { ...b, status: "disemak" } : b));
      } catch {}
    }
  };

  const handleBack = () => navigate(-1);

  const getFieldLabel = (formType, key) => {
    const cfg = FORMS_CONFIG.find((f) => f.id === formType);
    return cfg?.fields.find((f) => f.key === key)?.label ?? key.replace(/_/g, " ");
  };
  const getColLabel = (formType, key) => {
    const cfg = FORMS_CONFIG.find((f) => f.id === formType);
    return cfg?.rowColumns?.find((c) => c.key === key)?.label ?? key.replace(/_/g, " ");
  };

  // Banner showing scope
  const scopeBanner = () => {
    if (userRole === "advisor") {
      if (!advisorClubs.length) return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Akaun anda belum ditetapkan kelab. Sila hubungi admin untuk menetapkan kelab yang dipertanggungjawabkan.
        </div>
      );
      return (
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="font-semibold">Skop kelulusan: </span>
          {advisorClubs.map((c, i) => <span key={i} className="ml-1 inline-flex items-center rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold">{c}</span>)}
        </div>
      );
    }
    if (userRole === "bendahari_kelab" && bkClub) return (
      <div className="rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm text-teal-800">
        <span className="font-semibold">Kelab: </span><span className="ml-1 inline-flex items-center rounded-full bg-teal-200 px-2 py-0.5 text-xs font-semibold">{bkClub}</span>
      </div>
    );
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Kelulusan Borang Kewangan"
        action={<button onClick={handleBack} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-red-900 hover:border-red-900 hover:text-white">Kembali</button>}
      />

      <div className="mx-auto max-w-7xl space-y-8 p-6">
        {scopeBanner()}

        {/* ── Borang Kewangan UTM ── */}
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-red-800">Borang Kewangan UTM Menunggu Kelulusan</h2>
          {borangError && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{borangError}</div>}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            {loadingBorang ? (
              <p className="p-6 text-sm text-gray-500">Memuatkan borang menunggu...</p>
            ) : borangList.length === 0 ? (
              <p className="p-6 text-sm text-gray-500">Tiada borang menunggu kelulusan.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-red-900 text-left">
                      {["Jenis Borang","Dihantar Oleh","Kelab","Tarikh Hantar","Tindakan"].map(h => (
                        <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-red-100">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-50">
                    {borangList.map(item => (
                      <tr key={item.id} className="hover:bg-red-50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.formName}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{item.createdByEmail}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{item.createdByClub || <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString("ms-MY") : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2 flex-wrap">
                            <button onClick={() => handleViewBorang(item)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700">Lihat</button>
                            <button onClick={() => handleBorangAction(item.id,"diluluskan")} disabled={borangActionId===item.id} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-green-700 disabled:opacity-60">Lulus</button>
                            <button onClick={() => handleBorangAction(item.id,"ditolak")} disabled={borangActionId===item.id} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-60">Tolak</button>
                            <button onClick={() => handleBorangAction(item.id,"selesai")} disabled={borangActionId===item.id} className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-purple-700 disabled:opacity-60">Selesai</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal Lihat Borang ── */}
      {viewingBorang && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <button onClick={() => setViewingBorang(null)} className="absolute right-4 top-4 rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700">✕</button>
            <h3 className="mb-0.5 text-base font-bold text-gray-900">{viewingBorang.formName}</h3>
            <p className="mb-5 text-xs text-gray-500">
              Dihantar oleh: {viewingBorang.createdByEmail}
              {viewingBorang.createdByClub && <span className="ml-2 text-gray-400">· {viewingBorang.createdByClub}</span>}
              <span className="ml-2">· {viewingBorang.createdAt?.toDate ? viewingBorang.createdAt.toDate().toLocaleDateString("ms-MY") : ""}</span>
            </p>
            <div className="divide-y divide-gray-100">
              {viewingBorang.formData && Object.entries(viewingBorang.formData).map(([key, value]) => (
                <div key={key} className="grid grid-cols-2 gap-2 py-2">
                  <span className="text-xs font-medium text-gray-500">{getFieldLabel(viewingBorang.formType, key)}</span>
                  <span className="text-sm text-gray-800">{value || <span className="text-gray-400">—</span>}</span>
                </div>
              ))}
            </div>
            {viewingBorang.rows && viewingBorang.rows.length > 0 && (
              <div className="mt-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Senarai Baris</p>
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Bil</th>
                        {Object.keys(viewingBorang.rows[0]).map(k => (
                          <th key={k} className="px-3 py-2 text-left font-semibold text-gray-600">{getColLabel(viewingBorang.formType, k)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {viewingBorang.rows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-500">{idx+1}</td>
                          {Object.values(row).map((v, vi) => <td key={vi} className="px-3 py-2 text-gray-700">{v||"—"}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {(FORMS_CONFIG.find((f) => f.id === viewingBorang.formType)?.mandatoryAttachments ?? []).map((att) => {
              const key = `${att.key}Files`;
              return viewingBorang[key]?.length > 0 && (
                <div key={key} className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                  <p className="mb-1 text-xs font-semibold text-blue-700">{att.label}</p>
                  <div className="flex flex-col gap-1">
                    {viewingBorang[key].map((f, i) => (
                      <a key={i} href={f.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-blue-600 underline hover:text-blue-800">
                        {f.name || `Lihat fail ${i + 1}`}
                      </a>
                    ))}
                  </div>
                </div>
              );
            })}
            {viewingBorang.formType === "penyerahan-cek-wang-tunai" && (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-amber-700">Disahkan Oleh (Diisi oleh Penasihat)</p>
                <div className="space-y-3">
                  {[
                    { key: "disahkan_nama",    label: "Nama",    type: "text", placeholder: "Nama pegawai pengesah" },
                    { key: "disahkan_jawatan", label: "Jawatan", type: "text", placeholder: "Jawatan pegawai pengesah" },
                    { key: "disahkan_tarikh",  label: "Tarikh",  type: "date" },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="mb-1 block text-xs font-medium text-amber-800">{f.label}</label>
                      <input
                        type={f.type}
                        value={advisorData[f.key] || ""}
                        onChange={e => setAdvisorData(p => ({ ...p, [f.key]: e.target.value }))}
                        className="w-full rounded-xl border border-amber-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-amber-400"
                        placeholder={f.placeholder}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={() => handleBorangAction(viewingBorang.id,"diluluskan")} disabled={borangActionId===viewingBorang.id} className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-60">Luluskan Borang</button>
              <button onClick={() => handleBorangAction(viewingBorang.id,"ditolak")} disabled={borangActionId===viewingBorang.id} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60">Tolak Borang</button>
              <button onClick={() => handleBorangAction(viewingBorang.id,"selesai")} disabled={borangActionId===viewingBorang.id} className="rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:opacity-60">Tandakan Selesai</button>
              <button onClick={() => setViewingBorang(null)} className="rounded-xl bg-gray-100 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-200">Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
