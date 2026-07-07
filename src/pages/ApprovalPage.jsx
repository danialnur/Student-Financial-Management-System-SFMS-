import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getPendingBorang, getPendingBorangByClub, getPendingBorangByClubs, getPendingBorangByCategory,
  getIntendedReviewerRole, updateBorangStatus,
} from "../services/formService";
import {
  getPdfSubmissions, getPdfSubmissionsByClub, getPdfSubmissionsByClubs, getPdfSubmissionsByCategory,
  updatePdfSubmissionStatus,
} from "../services/pdfSubmissionService";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/PageHeader";
import { FORMS_CONFIG } from "../config/formsConfig";
import { SignaturePanel } from "../components/SignatureCapture";

const SUBMIT_TO_LABELS = { bendahari_kelab: "Bendahari Kelab", advisor: "Penasihat", pegawai: "Pegawai" };

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const STATUS_ACTION_LABELS = { diluluskan: "meluluskan", ditolak: "menolak", selesai: "menandakan selesai" };
const STATUS_SUCCESS_LABELS = { diluluskan: "diluluskan", ditolak: "ditolak", selesai: "ditandakan selesai" };

export default function ApprovalPage() {
  const navigate = useNavigate();
  const { currentUser, userRole, userProfile, refreshProfile } = useAuth();

  const advisorClubs   = userProfile?.clubs   ?? [];
  const bkClub         = userProfile?.club    ?? "";
  const pegawaiCategory = userProfile?.category ?? "";

  const canActOn = (item) => userRole === "admin" || getIntendedReviewerRole(item) === userRole;

  const [borangList, setBorangList]         = useState([]);
  const [loadingBorang, setLoadingBorang]   = useState(true);
  const [borangError, setBorangError]       = useState("");
  const [borangActionId, setBorangActionId] = useState("");
  const [viewingBorang, setViewingBorang]   = useState(null);
  const [advisorData, setAdvisorData]       = useState({});

  // Generic reviewer-section state (config.reviewerSection) — shared by both
  // "fixed" (Form 1: one section, always required) and "choice" (Form 2: pick
  // at least one of several named boxes) kinds.
  const [reviewerFormData, setReviewerFormData]             = useState({});
  const [selectedReviewerOptions, setSelectedReviewerOptions] = useState([]);

  // Confirm-before-action / success-notification popups, shared across the
  // borang and PDF lists.
  const [confirmAction, setConfirmAction]     = useState(null); // { kind:"borang"|"pdf", id, status, label }
  const [actionSuccessMsg, setActionSuccessMsg] = useState("");

  const loadPendingBorang = async () => {
    try {
      setLoadingBorang(true); setBorangError("");
      let list;
      if (userRole === "bendahari_kelab") {
        list = bkClub ? await getPendingBorangByClub(bkClub) : [];
      } else if (userRole === "advisor") {
        list = advisorClubs.length ? await getPendingBorangByClubs(advisorClubs) : [];
      } else if (userRole === "pegawai") {
        list = await getPendingBorangByCategory(pegawaiCategory);
      } else {
        // admin — sees everything, unrestricted
        list = await getPendingBorang();
      }
      setBorangList(list);
    } catch { setBorangError("Gagal memuatkan borang menunggu."); }
    finally { setLoadingBorang(false); }
  };

  const [pdfList, setPdfList]         = useState([]);
  const [loadingPdf, setLoadingPdf]   = useState(true);
  const [pdfError, setPdfError]       = useState("");
  const [pdfActionId, setPdfActionId] = useState("");

  const loadPendingPdf = async () => {
    try {
      setLoadingPdf(true); setPdfError("");
      let list;
      if (userRole === "bendahari_kelab") {
        list = bkClub ? await getPdfSubmissionsByClub(bkClub) : [];
      } else if (userRole === "advisor") {
        list = advisorClubs.length ? await getPdfSubmissionsByClubs(advisorClubs) : [];
      } else if (userRole === "pegawai") {
        list = await getPdfSubmissionsByCategory(pegawaiCategory);
      } else {
        // admin — sees everything, unrestricted
        list = await getPdfSubmissions();
      }
      setPdfList(list);
    } catch { setPdfError("Gagal memuatkan PDF menunggu."); }
    finally { setLoadingPdf(false); }
  };

  useEffect(() => {
    loadPendingBorang();
    loadPendingPdf();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole, userProfile]);

  // ── Reviewer-section helpers (config.reviewerSection) ──────────────────────
  const getReviewerAutoFillValue = (source) => {
    if (source === "fullName") return userProfile?.fullName || userProfile?.username || currentUser?.email || "";
    if (source === "phone")    return userProfile?.phone || "";
    if (source === "today")    return todayISO();
    return "";
  };

  const initReviewerSectionState = (cfg) => {
    setSelectedReviewerOptions([]);
    if (!cfg?.reviewerSection) { setReviewerFormData({}); return; }
    if (cfg.reviewerSection.kind === "fixed") {
      const init = {};
      cfg.reviewerSection.fields.forEach(f => {
        if (f.autoFillReviewer) init[f.key] = getReviewerAutoFillValue(f.autoFillReviewer);
      });
      setReviewerFormData(init);
    } else {
      setReviewerFormData({});
    }
  };

  const toggleReviewerOption = (optKey) => {
    setSelectedReviewerOptions(prev => prev.includes(optKey) ? prev.filter(k => k !== optKey) : [...prev, optKey]);
  };

  const validateReviewerSection = (cfg) => {
    const rs = cfg?.reviewerSection;
    if (!rs) return null;
    if (rs.kind === "fixed") {
      const missing = rs.fields.find(f => f.required && !reviewerFormData[f.key]);
      if (missing) return `Sila lengkapkan "${missing.label}" di bahagian "${rs.label}" sebelum meluluskan.`;
    } else if (rs.kind === "choice") {
      if (selectedReviewerOptions.length < (rs.minSelected ?? 1)) {
        return `Sila pilih sekurang-kurangnya ${rs.minSelected ?? 1} bahagian di "${rs.label}" untuk ditandatangani.`;
      }
      for (const optKey of selectedReviewerOptions) {
        const opt = rs.options.find(o => o.key === optKey);
        const missing = opt?.fields.find(f => f.required && !reviewerFormData[f.key]);
        if (missing) return `Sila lengkapkan "${missing.label}" untuk "${opt.label}".`;
      }
    }
    return null;
  };

  const buildReviewerDataPayload = (cfg) => {
    const rs = cfg?.reviewerSection;
    if (!rs) return null;
    return rs.kind === "choice"
      ? { selectedOptions: selectedReviewerOptions, ...reviewerFormData }
      : { ...reviewerFormData };
  };

  const renderReviewerField = (f) => {
    if (f.type === "signature") {
      return (
        <div key={f.key}>
          <label className="mb-1 block text-xs font-medium text-amber-800">{f.label}</label>
          <SignaturePanel
            savedSignatures={userProfile?.signatures ?? []}
            uid={currentUser?.uid}
            activeSig={reviewerFormData[f.key] || null}
            onActiveSig={val => setReviewerFormData(p => ({ ...p, [f.key]: val }))}
            onRefresh={refreshProfile}
          />
        </div>
      );
    }
    const shared = "w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition border-amber-200 bg-white focus:border-amber-400";
    if (f.type === "select") {
      return (
        <div key={f.key}>
          <label className="mb-1 block text-xs font-medium text-amber-800">{f.label}</label>
          <select
            value={reviewerFormData[f.key] || ""}
            onChange={e => setReviewerFormData(p => ({ ...p, [f.key]: e.target.value }))}
            className={shared}
          >
            <option value="">-- Pilih --</option>
            {(f.options ?? []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
      );
    }
    if (f.type === "textarea") {
      return (
        <div key={f.key}>
          <label className="mb-1 block text-xs font-medium text-amber-800">{f.label}</label>
          <textarea
            value={reviewerFormData[f.key] || ""}
            onChange={e => setReviewerFormData(p => ({ ...p, [f.key]: e.target.value }))}
            rows={3}
            className={shared}
          />
        </div>
      );
    }
    return (
      <div key={f.key}>
        <label className="mb-1 block text-xs font-medium text-amber-800">{f.label}</label>
        <input
          type={f.type}
          value={reviewerFormData[f.key] || ""}
          onChange={e => setReviewerFormData(p => ({ ...p, [f.key]: e.target.value }))}
          readOnly={!!f.autoFillReviewer}
          className={`${shared} ${f.autoFillReviewer ? "border-amber-100 bg-amber-100/50 text-gray-500 cursor-not-allowed" : ""}`}
        />
      </div>
    );
  };

  const renderReviewerSection = (cfg) => {
    const rs = cfg?.reviewerSection;
    if (!rs) return null;
    return (
      <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-amber-700">{rs.label}</p>
        {rs.kind === "fixed" && <div className="space-y-3">{rs.fields.map(renderReviewerField)}</div>}
        {rs.kind === "choice" && (
          <div className="space-y-3">
            <p className="text-xs text-amber-700">Pilih sekurang-kurangnya satu bahagian untuk ditandatangani:</p>
            {rs.options.map(opt => (
              <div key={opt.key} className="rounded-lg border border-amber-200 bg-white p-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                  <input type="checkbox" checked={selectedReviewerOptions.includes(opt.key)} onChange={() => toggleReviewerOption(opt.key)} />
                  {opt.label}
                </label>
                {selectedReviewerOptions.includes(opt.key) && (
                  <div className="mt-2 space-y-2">{opt.fields.map(renderReviewerField)}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ── Actions (confirm-gated) ──────────────────────────────────────────────────
  const handleRequestBorangAction = (item, status) => {
    if (status === "diluluskan") {
      const cfg = FORMS_CONFIG.find(f => f.id === item.formType);
      // Approving from the list directly (without having opened "Lihat" for
      // this item yet) when a reviewer section is required — open the detail
      // view instead of failing validation with no context.
      if (cfg?.reviewerSection && viewingBorang?.id !== item.id) { handleViewBorang(item); return; }
      const err = validateReviewerSection(cfg);
      if (err) { setBorangError(err); return; }
    }
    setBorangError("");
    setConfirmAction({ kind: "borang", id: item.id, status, item });
  };

  const handleRequestPdfAction = (item, status) => {
    setPdfError("");
    setConfirmAction({ kind: "pdf", id: item.id, status });
  };

  const handleConfirmedAction = async () => {
    if (!confirmAction) return;
    const { kind, id, status, item } = confirmAction;
    if (kind === "borang") await handleBorangAction(id, status, item);
    else await handlePdfAction(id, status);
  };

  const handleBorangAction = async (id, status, item) => {
    try {
      setBorangActionId(id); setConfirmAction(null);
      const cfg = FORMS_CONFIG.find(f => f.id === item?.formType);
      const extra = {};
      if (status === "diluluskan" && cfg?.reviewerSection) {
        extra.reviewerData = buildReviewerDataPayload(cfg);
      }
      if (Object.values(advisorData).some(v => v)) extra.advisorData = advisorData;
      await updateBorangStatus(id, status, { uid: currentUser.uid, email: currentUser.email }, extra);
      await loadPendingBorang();
      setViewingBorang(null); setAdvisorData({}); setReviewerFormData({}); setSelectedReviewerOptions([]);
      setActionSuccessMsg(`Borang berjaya ${STATUS_SUCCESS_LABELS[status] ?? "dikemaskini"}.`);
    } catch (e) { console.error(e); setBorangError(`Gagal ${STATUS_ACTION_LABELS[status] ?? "mengemaskini"} borang.`); }
    finally { setBorangActionId(""); }
  };

  const handlePdfAction = async (id, status) => {
    try {
      setPdfActionId(id); setConfirmAction(null);
      await updatePdfSubmissionStatus(id, status, { uid: currentUser.uid, email: currentUser.email });
      await loadPendingPdf();
      setActionSuccessMsg(`PDF berjaya ${STATUS_SUCCESS_LABELS[status] ?? "dikemaskini"}.`);
    } catch (e) { console.error(e); setPdfError(`Gagal ${STATUS_ACTION_LABELS[status] ?? "mengemaskini"} PDF.`); }
    finally { setPdfActionId(""); }
  };

  const handleViewBorang = async (item) => {
    setAdvisorData({});
    const cfg = FORMS_CONFIG.find(f => f.id === item.formType);
    initReviewerSectionState(cfg);
    setViewingBorang(item);
    if (item.status === "menunggu" && canActOn(item)) {
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
          <span className="font-semibold">Skop paparan: </span>
          {advisorClubs.map((c, i) => <span key={i} className="ml-1 inline-flex items-center rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold">{c}</span>)}
        </div>
      );
    }
    if (userRole === "bendahari_kelab" && bkClub) return (
      <div className="rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm text-teal-800">
        <span className="font-semibold">Kelab: </span><span className="ml-1 inline-flex items-center rounded-full bg-teal-200 px-2 py-0.5 text-xs font-semibold">{bkClub}</span>
      </div>
    );
    if (userRole === "pegawai" && pegawaiCategory) return (
      <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
        <span className="font-semibold">Bahagian: </span><span className="ml-1 inline-flex items-center rounded-full bg-indigo-200 px-2 py-0.5 text-xs font-semibold">{pegawaiCategory}</span>
      </div>
    );
    return null;
  };

  const ActionCell = ({ item, onView, onAction, viewLabel = "Lihat" }) => {
    if (!canActOn(item)) {
      return (
        <div className="flex flex-col gap-1.5">
          {onView && <button onClick={onView} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700">{viewLabel}</button>}
          <span className="text-[11px] italic text-gray-400">Menunggu tindakan {SUBMIT_TO_LABELS[getIntendedReviewerRole(item)] ?? getIntendedReviewerRole(item)}</span>
        </div>
      );
    }
    const busy = borangActionId === item.id || pdfActionId === item.id;
    return (
      <div className="flex gap-2 flex-wrap">
        {onView && <button onClick={onView} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700">{viewLabel}</button>}
        <button onClick={() => onAction("diluluskan")} disabled={busy} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-green-700 disabled:opacity-60">Lulus</button>
        <button onClick={() => onAction("ditolak")} disabled={busy} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-60">Tolak</button>
        <button onClick={() => onAction("selesai")} disabled={busy} className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-purple-700 disabled:opacity-60">Selesai</button>
      </div>
    );
  };

  const viewingCfg = viewingBorang ? FORMS_CONFIG.find((f) => f.id === viewingBorang.formType) : null;
  const viewingCanAct = viewingBorang ? canActOn(viewingBorang) : false;

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
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {item.formName}
                          <span className="ml-2 inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                            → {SUBMIT_TO_LABELS[getIntendedReviewerRole(item)] ?? getIntendedReviewerRole(item)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{item.createdByEmail}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{item.createdByClub || <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString("ms-MY") : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <ActionCell item={item} onView={() => handleViewBorang(item)} onAction={(status) => handleRequestBorangAction(item, status)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── Borang PDF ── */}
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-red-800">Borang PDF Menunggu Kelulusan</h2>
          {pdfError && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{pdfError}</div>}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            {loadingPdf ? (
              <p className="p-6 text-sm text-gray-500">Memuatkan PDF menunggu...</p>
            ) : pdfList.length === 0 ? (
              <p className="p-6 text-sm text-gray-500">Tiada PDF menunggu kelulusan.</p>
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
                    {pdfList.map(item => (
                      <tr key={item.id} className="hover:bg-red-50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {item.formName}
                          <span className="ml-2 inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                            → {SUBMIT_TO_LABELS[getIntendedReviewerRole(item)] ?? getIntendedReviewerRole(item)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{item.createdByEmail}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{item.createdByClub || <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString("ms-MY") : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <ActionCell
                            item={item}
                            onView={() => window.open(item.pdfUrl, "_blank", "noreferrer")}
                            viewLabel="Lihat PDF"
                            onAction={(status) => handleRequestPdfAction(item, status)}
                          />
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
            <h3 className="mb-0.5 text-base font-bold text-gray-900">
              {viewingBorang.formName}
              <span className="ml-2 inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 align-middle">
                → {SUBMIT_TO_LABELS[getIntendedReviewerRole(viewingBorang)] ?? getIntendedReviewerRole(viewingBorang)}
              </span>
            </h3>
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
            {viewingCanAct && renderReviewerSection(viewingCfg)}
            {viewingCanAct ? (
              <div className="mt-6 flex flex-wrap gap-3">
                <button onClick={() => handleRequestBorangAction(viewingBorang,"diluluskan")} disabled={borangActionId===viewingBorang.id} className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-60">Luluskan Borang</button>
                <button onClick={() => handleRequestBorangAction(viewingBorang,"ditolak")} disabled={borangActionId===viewingBorang.id} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60">Tolak Borang</button>
                <button onClick={() => handleRequestBorangAction(viewingBorang,"selesai")} disabled={borangActionId===viewingBorang.id} className="rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:opacity-60">Tandakan Selesai</button>
                <button onClick={() => setViewingBorang(null)} className="rounded-xl bg-gray-100 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-200">Tutup</button>
              </div>
            ) : (
              <div className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                <span className="text-xs italic text-gray-500">
                  Menunggu tindakan {SUBMIT_TO_LABELS[getIntendedReviewerRole(viewingBorang)] ?? getIntendedReviewerRole(viewingBorang)} — anda hanya boleh melihat borang ini.
                </span>
                <button onClick={() => setViewingBorang(null)} className="shrink-0 rounded-xl bg-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-300">Tutup</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Confirm action popup ── */}
      {confirmAction && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
              <svg className="h-7 w-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h3 className="mb-2 text-base font-bold text-gray-900">
              Sahkan {STATUS_ACTION_LABELS[confirmAction.status] ?? "tindakan"}?
            </h3>
            <p className="mb-6 text-sm text-gray-500">Tindakan ini akan mengemaskini status borang serta-merta.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmAction(null)} className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">Batal</button>
              <button onClick={handleConfirmedAction} className="flex-1 rounded-xl bg-red-900 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800">Ya, Teruskan</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Success notification popup ── */}
      {actionSuccessMsg && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="mb-2 text-base font-bold text-gray-900">Berjaya</h3>
            <p className="mb-6 text-sm text-gray-500">{actionSuccessMsg}</p>
            <button onClick={() => setActionSuccessMsg("")} className="w-full rounded-xl bg-red-900 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800">OK</button>
          </div>
        </div>
      )}
    </div>
  );
}
