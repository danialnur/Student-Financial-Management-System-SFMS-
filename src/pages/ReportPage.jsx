// ReportPage.jsx

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getApprovedTransactionsForReport } from "../services/reportService";
import { submitBorang, updateBorangFields, getBorangByUser, getIntendedReviewerRole } from "../services/formService";
import { getActiveReviewersByScope } from "../services/userService";
import { getTransactionsByUser } from "../services/transactionService";
import { getProgrammesByClub } from "../services/programmeService";
import { submitPdfBorang } from "../services/pdfSubmissionService";
import { useAuth } from "../context/AuthContext";
import { FORMS_CONFIG } from "../config/formsConfig";
import { MALAYSIA_STATES_CITIES } from "../config/malaysiaCities";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase/config";
import { SignaturePanel, resolveToDataUrl } from "../components/SignatureCapture";
import { openPdf, PDF_GENERATORS } from "../utils/borangPdfGenerators";

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const formatIcNumber = (raw) => {
  const digits = raw.replace(/\D/g, "").slice(0, 12);
  if (digits.length <= 6) return digits;
  if (digits.length <= 8) return `${digits.slice(0, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`;
};

// Lets a date be typed as plain digits (YYYYMMDD), auto-formatting to YYYY-MM-DD as you go
const formatDateTyped = (raw) => {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
};

// Strips anything that isn't a digit or a single decimal point (blocks letters entirely)
const filterMoneyInput = (raw) => {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned;
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
};

// Best-effort split of a joined "alamat_1, alamat_2, poskod, bandar, negeri" string
// (the exact format AddressField.build() produces) back into parts, so a row-popout
// address editor can be re-opened for editing without losing prior structure.
function parseAlamatPenuh(str) {
  if (!str) return { baris1: "", baris2: "", poskod: "", bandar: "", negeri: "" };
  const parts = str.split(",").map(s => s.trim()).filter(Boolean);
  if (parts.length >= 4) {
    const negeri = parts[parts.length - 1];
    const bandar = parts[parts.length - 2];
    const poskod = parts[parts.length - 3];
    if (/^\d{4,5}$/.test(poskod)) {
      const rest = parts.slice(0, parts.length - 3);
      return { baris1: rest[0] || "", baris2: rest.slice(1).join(", "), poskod, bandar, negeri };
    }
  }
  return { baris1: str, baris2: "", poskod: "", bandar: "", negeri: "" };
}

// Autosaves in-progress form input to localStorage (per form type + user) so
// a treasurer doesn't lose unsent work if they navigate away before submitting.
const draftKey = (formId, uid) => `sfms_draft_${formId}_${uid}`;
function saveDraft(formId, uid, formData, rows) {
  try { localStorage.setItem(draftKey(formId, uid), JSON.stringify({ formData, rows, savedAt: Date.now() })); } catch {}
}
function loadDraft(formId, uid) {
  try { const r = localStorage.getItem(draftKey(formId, uid)); return r ? JSON.parse(r) : null; } catch { return null; }
}
function clearDraft(formId, uid) {
  try { localStorage.removeItem(draftKey(formId, uid)); } catch {}
}

// ─── Misc helpers ─────────────────────────────────────────────────────────────
const statusLabel=(s)=>{
  if(s==="diluluskan") return "Diluluskan";
  if(s==="ditolak") return "Ditolak";
  if(s==="disemak") return "Sedang Disemak";
  if(s==="selesai") return "Selesai";
  return "Sudah Dihantar";
};
const statusBadge=(s)=>{
  const b="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold";
  if(s==="diluluskan") return `${b} bg-green-100 text-green-700`;
  if(s==="ditolak") return `${b} bg-red-100 text-red-700`;
  if(s==="disemak") return `${b} bg-blue-100 text-blue-700`;
  if(s==="selesai") return `${b} bg-purple-100 text-purple-700`;
  return `${b} bg-amber-100 text-amber-700`;
};
const typeLabel=(t)=>t==="income"?"Pendapatan":"Perbelanjaan";
const SUBMIT_TO_LABELS = { bendahari_kelab: "Bendahari Kelab", advisor: "Penasihat Kelab", pegawai: "Pegawai Kewangan" };
// Builds one blank row object for a form's repeatable table section
// (config.isRowSection, e.g. "Lampiran A senarai penerima"), keyed by that
// form's own rowColumns — different forms have different row shapes.
const emptyRowFor=(config)=>{ const r={}; config.rowColumns.forEach(c=>{r[c.key]=""}); return r; };
const initialRowsFor=(config)=> config.rowColumns ? Array.from({length: config.fixedRowCount || 1}, () => emptyRowFor(config)) : [];

// ─── Address widget ───────────────────────────────────────────────────────────
function AddressField({ formData, onMultiChange, fieldClass, uid }) {
  const [negeriSearch, setNegeriSearch] = useState(formData.alamat_negeri || "");
  const [bandarSearch, setBandarSearch] = useState(formData.alamat_bandar || "");
  const [showNegeri, setShowNegeri] = useState(false);
  const [showBandar, setShowBandar] = useState(false);
  const [addressSaved, setAddressSaved] = useState(false);
  const negeriRef = useRef(null), bandarRef = useRef(null);

  useEffect(() => { setNegeriSearch(formData.alamat_negeri || ""); }, [formData.alamat_negeri]);
  useEffect(() => { setBandarSearch(formData.alamat_bandar || ""); }, [formData.alamat_bandar]);

  useEffect(() => {
    const h = (e) => {
      if (negeriRef.current && !negeriRef.current.contains(e.target)) setShowNegeri(false);
      if (bandarRef.current && !bandarRef.current.contains(e.target)) setShowBandar(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const build = (ov) => {
    const d = { ...formData, ...ov };
    return [d.alamat_1, d.alamat_2, d.alamat_poskod, d.alamat_bandar, d.alamat_negeri].filter(Boolean).join(", ");
  };
  const update = (ov) => onMultiChange({ ...ov, alamat: build(ov) });
  const handleSaveAddress = () => {
    if (!uid) return;
    const payload = {
      alamat_1: formData.alamat_1 || "", alamat_2: formData.alamat_2 || "",
      alamat_negeri: formData.alamat_negeri || "", alamat_bandar: formData.alamat_bandar || "",
      alamat_poskod: formData.alamat_poskod || "", alamat: formData.alamat || "",
    };
    try {
      localStorage.setItem(`sfms_address_${uid}`, JSON.stringify(payload));
      setAddressSaved(true);
      setTimeout(() => setAddressSaved(false), 2500);
    } catch {}
  };
  const fN = Object.keys(MALAYSIA_STATES_CITIES).filter(s => s.toLowerCase().includes(negeriSearch.toLowerCase()));
  const fB = formData.alamat_negeri ? (MALAYSIA_STATES_CITIES[formData.alamat_negeri] || []).filter(c => c.toLowerCase().includes(bandarSearch.toLowerCase())) : [];
  const dC = "absolute z-20 mt-1 max-h-44 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg";
  const dI = (sel) => `cursor-pointer px-3 py-2 text-sm transition hover:bg-red-50 hover:text-red-800 ${sel ? "bg-red-50 font-semibold text-red-800" : "text-gray-700"}`;
  const req = <span className="ml-0.5 text-red-600">*</span>;

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Alamat 1{req}</label>
        <input type="text" value={formData.alamat_1 || ""} onChange={e => update({ alamat_1: e.target.value })} className={fieldClass} placeholder="M42, Kolej Tun Dr Ismail" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Alamat 2 <span className="font-normal text-gray-400">(pilihan)</span></label>
        <input type="text" value={formData.alamat_2 || ""} onChange={e => update({ alamat_2: e.target.value })} className={fieldClass} placeholder="Universiti Teknologi Malaysia" />
      </div>
      <div ref={negeriRef} className="relative">
        <label className="mb-1 block text-xs font-medium text-gray-600">Negeri{req}</label>
        <input type="text" value={negeriSearch}
          onChange={e => { setNegeriSearch(e.target.value); setShowNegeri(true); if (formData.alamat_negeri) { update({ alamat_negeri: "", alamat_bandar: "" }); setBandarSearch(""); } }}
          onFocus={() => setShowNegeri(true)} className={fieldClass} placeholder="Taip untuk mencari negeri..." />
        {showNegeri && fN.length > 0 && (
          <ul className={dC}>{fN.map(s => <li key={s} onMouseDown={() => { update({ alamat_negeri: s, alamat_bandar: "" }); setNegeriSearch(s); setBandarSearch(""); setShowNegeri(false); }} className={dI(formData.alamat_negeri === s)}>{s}</li>)}</ul>
        )}
      </div>
      <div ref={bandarRef} className="relative">
        <label className="mb-1 block text-xs font-medium text-gray-600">Bandar / Daerah{req}</label>
        <input type="text" value={bandarSearch} disabled={!formData.alamat_negeri}
          onChange={e => { setBandarSearch(e.target.value); setShowBandar(true); if (formData.alamat_bandar) update({ alamat_bandar: "" }); }}
          onFocus={() => { if (formData.alamat_negeri) setShowBandar(true); }}
          className={`${fieldClass} ${!formData.alamat_negeri ? "cursor-not-allowed bg-gray-50 text-gray-400" : ""}`}
          placeholder={formData.alamat_negeri ? "Taip untuk mencari bandar..." : "Pilih negeri dahulu"} />
        {showBandar && fB.length > 0 && (
          <ul className={dC}>{fB.map(c => <li key={c} onMouseDown={() => { update({ alamat_bandar: c }); setBandarSearch(c); setShowBandar(false); }} className={dI(formData.alamat_bandar === c)}>{c}</li>)}</ul>
        )}
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Poskod{req}</label>
        <input type="text" value={formData.alamat_poskod || ""} onChange={e => update({ alamat_poskod: e.target.value.replace(/\D/g,"").slice(0,5) })} className={fieldClass} placeholder="81300" maxLength={5} />
      </div>
      {formData.alamat && <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"><p className="text-xs italic text-gray-600">{formData.alamat}</p></div>}
      {formData.alamat_1 && formData.alamat_negeri && formData.alamat_bandar && formData.alamat_poskod && (
        <div className="flex items-center gap-2">
          <button type="button" onClick={handleSaveAddress} className="rounded-lg border border-dashed border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 transition hover:border-blue-400 hover:bg-blue-100">
            💾 Simpan Alamat Ini untuk Kegunaan Akan Datang
          </button>
          {addressSaved && <span className="text-xs font-semibold text-green-600">✓ Alamat disimpan</span>}
        </div>
      )}
    </div>
  );
}
// ─── Main component ───────────────────────────────────────────────────────────
export default function ReportPage({ tab: forcedTab }) {
  const navigate = useNavigate();
  const { currentUser, userRole, userProfile, refreshProfile } = useAuth();

  // Resolves what value to prefill for a given form field key. Checks a few
  // hardcoded field-name conventions first (organisasi/program/disediakan_*),
  // then falls back to the generic autoFillFields map declared per-form in
  // formsConfig.js — this is what lets one renderer drive all 9 KEW forms
  // without each needing its own prefill logic.
  const getAutoFillValue = (key, formId) => {
    const uid = currentUser?.uid;
    if (key === "organisasi" || key === "nama_persatuan" || key === "anjuran" || key === "persatuan_jkm") return localStorage.getItem(`sfms_club_${uid}`) || "";
    if (key === "program" || key === "nama_program") { try { return JSON.parse(localStorage.getItem(`sfms_prog_${uid}`)||"null")?.name||""; } catch { return ""; } }
    const formCfg = FORMS_CONFIG.find(f => f.id === formId);
    if (formCfg?.autoFillDisediakanOleh) {
      if (key === "disediakan_nama")    return userProfile?.fullName || userProfile?.username || currentUser?.email || "";
      if (key === "disediakan_jawatan") {
        let progName = "";
        try { progName = JSON.parse(localStorage.getItem(`sfms_prog_${uid}`)||"null")?.name||""; } catch {}
        return progName ? `Bendahari ${progName}` : "Bendahari";
      }
      if (key === "disediakan_tarikh")  return todayISO();
    }
    if (formCfg?.autoFillPemohon) {
      if (key === "nama")       return userProfile?.fullName || userProfile?.username || currentUser?.email || "";
      if (key === "no_matrik")  return userProfile?.matricNumber || "";
      if (key === "no_kp")      return userProfile?.icNumber || "";
      if (key === "no_telefon") return userProfile?.phone || "";
      if (key === "tarikh_tandatangan") return todayISO();
    }
    if (formCfg?.autoFillAkuanWangTunai) {
      if (key === "namapenuh_penerima") return userProfile?.fullName || userProfile?.username || currentUser?.email || "";
      if (key === "no_kp_penerima")     return userProfile?.icNumber || "";
      if (key === "diterima_nama")      return userProfile?.fullName || userProfile?.username || currentUser?.email || "";
      if (key === "diterima_tel")       return userProfile?.phone || "";
      if (key === "diterima_tarikh")    return todayISO();
    }
    // Generic per-field auto-fill map: { fieldKey: "fullName"|"icNumber"|"phone"|"matricNumber"|"today"|"club"|"program" }
    const source = formCfg?.autoFillFields?.[key];
    if (source === "fullName")     return userProfile?.fullName || userProfile?.username || currentUser?.email || "";
    if (source === "icNumber")     return userProfile?.icNumber || "";
    if (source === "phone")        return userProfile?.phone || "";
    if (source === "matricNumber") return userProfile?.matricNumber || "";
    if (source === "today")        return todayISO();
    if (source === "club")         return localStorage.getItem(`sfms_club_${uid}`) || "";
    if (source === "program")      { try { return JSON.parse(localStorage.getItem(`sfms_prog_${uid}`)||"null")?.name||""; } catch { return ""; } }
    return null;
  };

  const [activeTab, setActiveTab]           = useState(() => forcedTab ?? (userRole === "treasurer" ? "borang" : "laporan"));
  const [filterMode, setFilterMode]         = useState("julat"); // "julat" | "keseluruhan"
  const [startDate, setStartDate]           = useState("");
  const [endDate, setEndDate]               = useState("");
  const [records, setRecords]               = useState([]);
  const [loading, setLoading]               = useState(false);
  const [errorMsg, setErrorMsg]             = useState("");
  const [message, setMessage]               = useState("");
  const [progContext, setProgContext]        = useState(null);
  const [clubProgrammes, setClubProgrammes]         = useState([]);
  const [loadingClubProgrammes, setLoadingClubProgrammes] = useState(false);
  const [selectedProgCodes, setSelectedProgCodes]   = useState([]); // bendahari_kelab report filter — empty = all
  const [openFormId, setOpenFormId]         = useState(null);
  // Set while editing an existing (still-pending) submission via "Sunting" in
  // Status Penyerahan Borang, instead of creating a new one — reuses the same
  // form modal/state as a fresh submission but routes to updateBorangFields.
  const [editingSubmissionId, setEditingSubmissionId] = useState(null);
  const [formData, setFormData]             = useState({});
  const [rows, setRows]                     = useState([]);
  const [submitting, setSubmitting]         = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [formMsg, setFormMsg]               = useState({ type:"", text:"" });
  const [submissions, setSubmissions]       = useState([]);
  // "Disemak Oleh" doesn't come from the submission doc itself — it's resolved
  // live per (intended reviewer role, club/category) pair, since we want who
  // will actually act on it, not everyone who merely has view access to it.
  const [reviewerNames, setReviewerNames]   = useState({}); // "role|scope" -> "user1, user2"
  const [submissionSort, setSubmissionSort] = useState({ col: null, dir: null });
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [hasDraft, setHasDraft]             = useState(false);
  const [draftList, setDraftList]           = useState([]);
  const [showDrafts, setShowDrafts]         = useState(false);
  // e-signature (inline panel in form)
  const [activeSig, setActiveSig]           = useState(null);
  // Destination choice for forms with config.allowSubmitToChoice: null | "advisor" | "pegawai"
  const [submitTo, setSubmitTo]             = useState(null);
  // cellPopout: { ri, key, label, placeholder, tempValue }
  const [cellPopout, setCellPopout]         = useState(null);
  // suratKelulusan: null | { uploading:bool, name:str, url:str|null, path:str }
  const [suratKelulusan, setSuratKelulusan] = useState(null);
  // Generic per-form mandatory attachments (config.mandatoryAttachments):
  // { [attachmentKey]: [{ id, uploading:bool, name:str, url:str|null, path:str }] }
  const [mandatoryFiles, setMandatoryFiles] = useState({});
  // Prompt shown when starting a "new" form that already has an unfinished draft: { config }
  const [existingDraftPrompt, setExistingDraftPrompt] = useState(null);
  // Muat Naik PDF Terus — direct raw-PDF upload bypassing the digital form
  const [directFormType, setDirectFormType]   = useState("");
  const [directFile, setDirectFile]           = useState(null);
  const [directSubmitTo, setDirectSubmitTo]   = useState(null);
  const [directSubmitting, setDirectSubmitting] = useState(false);
  const [directMsg, setDirectMsg]             = useState({ type:"", text:"" });
  // Row confirm/remove popups: { type:"confirm"|"remove", ri, label }
  const [confirmRowAction, setConfirmRowAction] = useState(null);
  const [rowActionSuccess, setRowActionSuccess] = useState("");
  // Confirmation popups shown before actually submitting (digital form / direct PDF upload)
  const [confirmSubmitBorang, setConfirmSubmitBorang] = useState(false);
  const [confirmDirectSubmit, setConfirmDirectSubmit] = useState(false);
  // Shown after a successful submission (either the digital form or the direct
  // PDF upload) — requires an explicit "OK" click rather than auto-dismissing,
  // so the user has clear, deliberate confirmation the submission went through.
  const [submitSuccessPopup, setSubmitSuccessPopup] = useState(null); // null | { kind:"borang"|"direct", text }

  useEffect(() => {
    if (!currentUser?.uid) return;
    try { setProgContext(JSON.parse(localStorage.getItem(`sfms_prog_${currentUser.uid}`))||null); } catch {}
  }, [currentUser?.uid]);

  // Bendahari Kelab can generate a report scoped to one or more of their club's programmes
  useEffect(() => {
    if (userRole !== "bendahari_kelab" || !userProfile?.club) return;
    setLoadingClubProgrammes(true);
    getProgrammesByClub(userProfile.club)
      .then(setClubProgrammes)
      .catch(() => setClubProgrammes([]))
      .finally(() => setLoadingClubProgrammes(false));
  }, [userRole, userProfile?.club]);

  const toggleProgCode = (code) => {
    setSelectedProgCodes(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
  };

  const refreshDraftList = useCallback(() => {
    if (!currentUser?.uid) return;
    setDraftList(FORMS_CONFIG.map(cfg => {
      try {
        const raw = localStorage.getItem(draftKey(cfg.id, currentUser.uid));
        if (!raw) return null;
        return { config: cfg, savedAt: JSON.parse(raw).savedAt };
      } catch { return null; }
    }).filter(Boolean));
  }, [currentUser?.uid]);

  const loadSubmissions = async () => {
    if (!currentUser?.uid) return;
    try { setLoadingSubmissions(true); setSubmissions(await getBorangByUser(currentUser.uid)); }
    catch (e) { console.error(e); } finally { setLoadingSubmissions(false); }
  };

  const handleSubmissionSort = (col) => {
    setSubmissionSort(prev => {
      if (prev.col !== col)   return { col, dir: "asc" };
      if (prev.dir === "asc") return { col, dir: "desc" };
      return { col: null, dir: null };
    });
  };

  const reviewerNameFor = (sub) => {
    const role = getIntendedReviewerRole(sub);
    const scope = role === "pegawai" ? sub.createdByCategory : sub.createdByClub;
    return reviewerNames[`${role}|${scope}`] || "";
  };

  const sortedSubmissions = useMemo(() => {
    const { col, dir } = submissionSort;
    if (!col) return submissions;
    return [...submissions].sort((a, b) => {
      let va, vb;
      if (col === "borang")  { va = a.formName || "";  vb = b.formName || ""; }
      else if (col === "tarikh") { va = a.createdAt?.seconds ?? 0; vb = b.createdAt?.seconds ?? 0; }
      else if (col === "status") { va = statusLabel(a.status); vb = statusLabel(b.status); }
      else if (col === "disemak") { va = reviewerNameFor(a); vb = reviewerNameFor(b); }
      else return 0;
      if (typeof va === "number") return dir === "asc" ? va - vb : vb - va;
      const cmp = va.localeCompare(vb);
      return dir === "asc" ? cmp : -cmp;
    });
  }, [submissions, submissionSort, reviewerNames]);

  useEffect(() => {
    if (activeTab === "borang" && userRole === "treasurer") { loadSubmissions(); refreshDraftList(); }
  }, [activeTab, currentUser?.uid]);

  // Resolve the actual reviewer username(s) once per unique (role, scope) pair
  // present in the current submissions, instead of one lookup per row.
  useEffect(() => {
    if (!submissions.length) return;
    const pairs = new Map();
    submissions.forEach(sub => {
      const role = getIntendedReviewerRole(sub);
      const scope = role === "pegawai" ? sub.createdByCategory : sub.createdByClub;
      if (scope) pairs.set(`${role}|${scope}`, { role, scope });
    });
    const toFetch = [...pairs.entries()].filter(([key]) => !(key in reviewerNames));
    if (!toFetch.length) return;
    Promise.all(toFetch.map(([key, { role, scope }]) =>
      getActiveReviewersByScope(role, scope).then(names => [key, names.join(", ")])
    )).then(results => {
      setReviewerNames(prev => ({ ...prev, ...Object.fromEntries(results) }));
    }).catch(console.error);
  }, [submissions]);

  // Form 8 (Penyata Kewangan + Senarai Resit): Wang Masuk / Wang Keluar totals and the
  // Senarai Resit Bayaran rows are derived live from the treasurer's own recorded
  // transactions for this programme, not typed in manually — refresh them on open.
  useEffect(() => {
    const cfg = FORMS_CONFIG.find(f => f.id === openFormId);
    if (!cfg?.rowsAutoFromTransactions || !currentUser?.uid) return;
    (async () => {
      try {
        const txns = await getTransactionsByUser(currentUser.uid, progContext?.code);
        const income  = txns.filter(t => t.type === "income");
        const expense = txns.filter(t => t.type === "expense");
        const sumBy = (list, cats) => list.filter(t => cats.includes(t.category)).reduce((s,t)=>s+Number(t.amount||0),0);
        setFormData(prev => ({
          ...prev,
          peruntukan_hepa_baki: sumBy(income, ["Peruntukan HEP"]).toFixed(2),
          tabung_persatuan:     sumBy(income, ["Tabung Persatuan"]).toFixed(2),
          yuran_penyertaan:     sumBy(income, ["Yuran Penyertaan"]).toFixed(2),
          penajaan:             sumBy(income, ["Penajaan"]).toFixed(2),
          sumbangan_lain:       sumBy(income, ["Sumbangan", "Lain-lain"]).toFixed(2),
          makan_minum:          sumBy(expense, ["Makan/Minum"]).toFixed(2),
          peralatan:            sumBy(expense, ["Peralatan"]).toFixed(2),
          pengangkutan:         sumBy(expense, ["Pengangkutan"]).toFixed(2),
          perhubungan:          sumBy(expense, ["Perhubungan"]).toFixed(2),
          cenderamata:          sumBy(expense, ["Cenderamata"]).toFixed(2),
          alat_tulis:           sumBy(expense, ["Alat Tulis", "Lain-lain"]).toFixed(2),
        }));
        setRows(expense
          .slice()
          .sort((a,b)=>(a.date||"").localeCompare(b.date||""))
          .map(t => ({
            tarikh_resit:     t.date || "",
            perkara:          t.category || "",
            no_resit:         (t.receipts||[]).map(r=>r.noResit).filter(Boolean).join(", "),
            jumlah:           t.amount != null ? Number(t.amount).toFixed(2) : "",
            tujuan_pembelian: t.description || "",
          })));
      } catch (e) { console.error(e); }
    })();
  }, [openFormId, currentUser?.uid, progContext?.code]);

  const summary = useMemo(() => {
    const ti = records.filter(i=>i.type==="income").reduce((s,i)=>s+Number(i.amount||0),0);
    const te = records.filter(i=>i.type==="expense").reduce((s,i)=>s+Number(i.amount||0),0);
    return { totalIncome:ti, totalExpense:te, balance:ti-te };
  }, [records]);

  const handleLoadReport = async () => {
    try {
      setLoading(true); setErrorMsg(""); setMessage("");
      const isFullProgramme = filterMode === "keseluruhan";
      const data = await getApprovedTransactionsForReport({
        role: userRole,
        uid: currentUser.uid,
        club: userProfile?.club,
        clubs: userProfile?.clubs,
        startDate: isFullProgramme ? "" : startDate,
        endDate:   isFullProgramme ? "" : endDate,
        programmeCode:  userRole === "treasurer"       ? progContext?.code : undefined,
        programmeCodes: userRole === "bendahari_kelab" && selectedProgCodes.length ? selectedProgCodes : undefined,
      });
      setRecords(data); setMessage("Penyata berjaya dimuatkan.");
    } catch { setErrorMsg("Gagal menjana penyata."); } finally { setLoading(false); }
  };

  const handleDownloadPdf = () => {
    if (!records.length) { setErrorMsg("Tiada data penyata untuk dimuat turun."); return; }
    const doc = new jsPDF(), title = userRole==="advisor"?"Penyata Kewangan Diluluskan":"Penyata Kewangan Saya";
    doc.setFontSize(16); doc.text(title,14,18); doc.setFontSize(10);
    doc.text(`Dijana oleh: ${currentUser.email}`,14,28);
    let y = 34;
    doc.text(`Julat Tarikh: ${filterMode==="keseluruhan" ? "Keseluruhan Program" : `${startDate||"Semua"} hingga ${endDate||"Semua"}`}`,14,y); y += 6;
    if (userRole === "bendahari_kelab") {
      const progText = selectedProgCodes.length ? selectedProgCodes.join(", ") : "Semua Program";
      doc.text(`Program: ${progText}`,14,y); y += 6;
    }
    doc.text(`Jumlah Pendapatan: RM ${summary.totalIncome.toFixed(2)}`,14,y); y += 6;
    doc.text(`Jumlah Perbelanjaan: RM ${summary.totalExpense.toFixed(2)}`,14,y); y += 6;
    doc.text(`Baki: RM ${summary.balance.toFixed(2)}`,14,y); y += 8;
    autoTable(doc,{ startY:y, head:[["Program","Tarikh","Catatan","Kategori","Jenis","Jumlah","Dibuat Oleh"]],
      body:records.map(i=>[i.programmeCode?`${i.programmeCode} — ${i.programmeName}`:"-",i.date||"-",i.description||"-",i.category||"-",typeLabel(i.type),`RM ${Number(i.amount||0).toFixed(2)}`,i.createdByEmail||"-"]),
      styles:{fontSize:8} });
    openPdf(doc);
  };

  const handleBack = () => navigate(-1);

  const ADDRESS_SUB_KEYS = ["alamat_1","alamat_2","alamat_negeri","alamat_bandar","alamat_poskod"];

  const openForm = (config, loadDraftIfExists = true) => {
    const initial = {};
    config.fields.forEach(f => { const av=getAutoFillValue(f.key, config.id); initial[f.key]=av!==null?av:""; });
    if ("alamat" in initial) {
      ADDRESS_SUB_KEYS.forEach(k=>{ initial[k]=""; });
      try {
        const savedAddress = JSON.parse(localStorage.getItem(`sfms_address_${currentUser?.uid}`) || "null");
        if (savedAddress) Object.assign(initial, savedAddress);
      } catch {}
    }
    const draft = loadDraftIfExists ? loadDraft(config.id, currentUser?.uid) : null;
    if (draft) {
      const restored = { ...(draft.formData??initial) };
      if ("alamat" in restored) ADDRESS_SUB_KEYS.forEach(k=>{ if(!(k in restored)) restored[k]=""; });
      config.fields.forEach(f=>{ const av=getAutoFillValue(f.key, config.id); if(av!==null) restored[f.key]=av; });
      setFormData(restored);
      setRows(draft.rows?.length ? draft.rows : initialRowsFor(config));
      setHasDraft(true);
    } else {
      setFormData(initial);
      setRows(initialRowsFor(config));
      setHasDraft(false);
    }
    setOpenFormId(config.id); setFormMsg({type:"",text:""}); setSubmitTo(null);
    if (!loadDraftIfExists) { setActiveSig(null); setSuratKelulusan(null); setMandatoryFiles({}); }
  };

  const closeForm = () => { setOpenFormId(null); setFormData({}); setRows([]); setFormMsg({type:"",text:""}); setHasDraft(false); setActiveSig(null); setSuratKelulusan(null); setMandatoryFiles({}); setSubmitTo(null); setEditingSubmissionId(null); };

  // "Sunting" on an existing, still-pending submission — loads its saved
  // content into the same form modal used for new submissions, but leaves the
  // draft system untouched (see the editingSubmissionId guards in the field/row
  // change handlers below) so editing doesn't clobber an unrelated in-progress draft.
  const handleEditSubmission = (sub) => {
    const config = FORMS_CONFIG.find(f => f.id === sub.formType);
    if (!config) return;
    setEditingSubmissionId(sub.id);
    setFormData(sub.formData ?? {});
    setRows(sub.rows?.length ? sub.rows : initialRowsFor(config));
    setActiveSig(sub.submitterSignature ?? null);
    setSuratKelulusan(sub.suratKelulusanUrl ? { uploading: false, name: sub.suratKelulusanName, url: sub.suratKelulusanUrl } : null);
    const files = {};
    (config.mandatoryAttachments ?? []).forEach(att => {
      files[att.key] = (sub[`${att.key}Files`] ?? []).map((f, i) => ({ id: `existing-${att.key}-${i}`, uploading: false, name: f.name, url: f.url, path: f.path }));
    });
    setMandatoryFiles(files);
    setSubmitTo(sub.submitTo ?? null);
    setHasDraft(false);
    setFormMsg({type:"",text:""});
    setOpenFormId(config.id);
  };

  // "Isi Borang Baru" click — warn first if an unfinished draft for this exact form already exists,
  // since opening fresh would otherwise silently overwrite it on the next keystroke.
  const handleStartNewForm = (config) => {
    const draft = loadDraft(config.id, currentUser?.uid);
    if (draft) { setExistingDraftPrompt({ config }); return; }
    openForm(config, false);
  };

  const handleContinueExistingDraft = () => {
    if (!existingDraftPrompt) return;
    openForm(existingDraftPrompt.config, true);
    setExistingDraftPrompt(null);
  };

  const handleDiscardExistingDraft = () => {
    if (!existingDraftPrompt) return;
    const { config } = existingDraftPrompt;
    clearDraft(config.id, currentUser?.uid);
    refreshDraftList();
    openForm(config, false);
    setExistingDraftPrompt(null);
  };

  const handleFieldChange = (key, value) => {
    setFormData(prev => { const u={...prev,[key]:value}; if(openFormId&&currentUser?.uid&&!editingSubmissionId) saveDraft(openFormId,currentUser.uid,u,rows); return u; });
  };

  const handleMultiFieldChange = (updates) => {
    setFormData(prev => { const u={...prev,...updates}; if(openFormId&&currentUser?.uid&&!editingSubmissionId) saveDraft(openFormId,currentUser.uid,u,rows); return u; });
  };

  const handleRowChange = (ri, ck, val) => {
    setRows(prev => { const u=prev.map((r,i)=>i===ri?{...r,[ck]:val}:r); if(openFormId&&currentUser?.uid&&!editingSubmissionId) saveDraft(openFormId,currentUser.uid,formData,u); return u; });
  };

  const addRow = () => { const cfg=FORMS_CONFIG.find(f=>f.id===openFormId); setRows(p=>[...p,emptyRowFor(cfg)]); };
  const removeRow = (ri) => setRows(p=>p.filter((_,i)=>i!==ri));

  const rowItemLabel = (row, cfg) => {
    const firstKey = cfg?.rowColumns?.[0]?.key;
    return row?.nama_penyumbang || (firstKey ? row?.[firstKey] : "") || "";
  };

  const handleRowConfirmClick = (ri, row, cfg) => {
    const allFilled = cfg.rowColumns.every(col => row[col.key]?.toString().trim());
    if (!allFilled) {
      setFormMsg({type:"error", text:"Sila lengkapkan semua maklumat baris ini sebelum mengesahkan."});
      return;
    }
    setConfirmRowAction({ type: "confirm", ri, label: rowItemLabel(row, cfg) });
  };

  const handleRowRemoveClick = (ri, row, cfg) => {
    setConfirmRowAction({ type: "remove", ri, label: rowItemLabel(row, cfg) });
  };

  const handleRowActionConfirmed = () => {
    if (!confirmRowAction) return;
    const { type, ri, label } = confirmRowAction;
    const noun = activeFormConfig?.id === "penyerahan-cek-wang-tunai" ? "Penyumbang" : "Entri";
    setConfirmRowAction(null);
    if (type === "remove") {
      removeRow(ri);
      setRowActionSuccess(label ? `${noun} "${label}" berjaya dibuang.` : `${noun} berjaya dibuang.`);
    } else {
      setRowActionSuccess(label ? `${noun} "${label}" berjaya ditambah.` : `${noun} berjaya ditambah.`);
    }
  };

  const discardDraft = () => {
    if (!openFormId||!currentUser?.uid) return;
    clearDraft(openFormId,currentUser.uid);
    const cfg=FORMS_CONFIG.find(f=>f.id===openFormId);
    const init={}; cfg.fields.forEach(f=>{init[f.key]="";});
    setFormData(init); setRows(initialRowsFor(cfg));
    setHasDraft(false); setFormMsg({type:"",text:""}); refreshDraftList();
  };

  const handleSuratUpload = async (file) => {
    if (!file) return;
    const ext = file.name.split(".").pop();
    const path = `surat_kelulusan/${currentUser.uid}/${Date.now()}.${ext}`;
    setSuratKelulusan({ uploading: true, name: file.name, url: null });
    try {
      const sRef = storageRef(storage, path);
      await uploadBytes(sRef, file);
      const url = await getDownloadURL(sRef);
      setSuratKelulusan({ uploading: false, name: file.name, url, path });
    } catch {
      setSuratKelulusan(null);
      setFormMsg({ type: "error", text: "Gagal memuat naik surat kelulusan. Sila cuba lagi." });
    }
  };

  // Generic per-form attachment upload, keyed by config.mandatoryAttachments[].key
  // (despite the name, individual entries may be optional via `required: false`)
  const handleMandatoryAttachmentUpload = async (file, attKey) => {
    if (!file) return;
    const cfg = FORMS_CONFIG.find(f => f.id === openFormId);
    const attDef = cfg?.mandatoryAttachments?.find(a => a.key === attKey);
    const current = mandatoryFiles[attKey] ?? [];
    if (attDef?.maxFiles && current.length >= attDef.maxFiles) {
      setFormMsg({ type: "error", text: `Maksimum ${attDef.maxFiles} fail dibenarkan untuk "${attDef.label}".` });
      return;
    }
    const tempId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const path = `mandatory_attachments/${attKey}/${currentUser.uid}/${Date.now()}-${file.name}`;
    setMandatoryFiles(prev => ({ ...prev, [attKey]: [...(prev[attKey] ?? []), { id: tempId, uploading: true, name: file.name, url: null }] }));
    try {
      const sRef = storageRef(storage, path);
      await uploadBytes(sRef, file);
      const url = await getDownloadURL(sRef);
      setMandatoryFiles(prev => ({ ...prev, [attKey]: (prev[attKey] ?? []).map(f => f.id === tempId ? { id: tempId, uploading: false, name: file.name, url, path } : f) }));
    } catch {
      setMandatoryFiles(prev => ({ ...prev, [attKey]: (prev[attKey] ?? []).filter(f => f.id !== tempId) }));
      setFormMsg({ type: "error", text: "Gagal memuat naik lampiran. Sila cuba lagi." });
    }
  };

  const removeMandatoryAttachment = (attKey, id) => {
    setMandatoryFiles(prev => ({ ...prev, [attKey]: (prev[attKey] ?? []).filter(f => f.id !== id) }));
  };

  const FORM_COOLDOWN_MS = 30_000;

  // Shared pre-submit validation, used by both "Hantar Borang" and "Hantar PDF"
  const validateSubmission = (config) => {
    const needsSig = config?.sections?.some(s=>s.fields?.some(f=>f.type==="signature"));
    if (needsSig && !activeSig) {
      return "Sila pilih atau lukis tandatangan di bahagian 'Disediakan Oleh' sebelum menghantar.";
    }
    if (config?.allowSubmitToChoice && !submitTo) {
      return "Sila pilih ke mana borang ini hendak dihantar.";
    }
    if (config?.rowColumnsAllRequired && config.rowColumns && rows.length > 0 && !config.rowsAutoFromTransactions) {
      let hasCompleteRow = false;
      for (const row of rows) {
        const allFilled = config.rowColumns.every(col => row[col.key]?.toString().trim());
        if (allFilled) { hasCompleteRow = true; continue; }
        const anyFilled = config.rowColumns.some(col => row[col.key]?.toString().trim());
        if (config.requireAllRowsFilled) {
          return `Sila lengkapkan kesemua ${rows.length} baris sebelum menghantar.`;
        }
        if (anyFilled) return "Sila lengkapkan semua medan dalam setiap baris senarai sebelum menghantar.";
      }
      if (config.rowsRequireAtLeastOne && !hasCompleteRow) {
        return "Sila lengkapkan sekurang-kurangnya satu baris penyumbang sepenuhnya.";
      }
    }
    if (config?.enforceRequiredFields) {
      const missing = config.fields.find(f => {
        if (!f.required || f.type === "signature") return false;
        if (f.type === "checkbox") return !formData[f.key];
        return !(formData[f.key]?.toString().trim());
      });
      if (missing) return `Sila lengkapkan medan "${missing.label}" sebelum menghantar.`;
    }
    for (const att of config?.mandatoryAttachments ?? []) {
      if (att.required === false) continue;
      if (!(mandatoryFiles[att.key] ?? []).some(f => f.url)) {
        return `Sila muat naik sekurang-kurangnya satu fail untuk "${att.label}".`;
      }
    }
    return null;
  };

  // Combines the user-selected "jawatan" role with the program name at
  // submit/PDF-generation time only, so the dropdown itself keeps showing
  // just the selected role while editing.
  const buildSubmissionFormData = (data, config) => {
    if (!config?.jawatanCombineWithProgram || !data.jawatan) return data;
    const progName = data.nama_program || data.program || "";
    return { ...data, jawatan: progName ? `${data.jawatan} ${progName}` : data.jawatan };
  };

  // Flattens the uploaded-files state for each of a form's mandatoryAttachments
  // slots into the `${key}Files` arrays actually persisted on the submission doc.
  const mandatoryAttachmentPayload = (config) => {
    const payload = {};
    (config?.mandatoryAttachments ?? []).forEach(att => {
      payload[`${att.key}Files`] = (mandatoryFiles[att.key] ?? []).filter(f => f.url).map(f => ({ url: f.url, name: f.name, path: f.path }));
    });
    return payload;
  };

  // Validate first so the confirm popup never shows on top of an already-invalid form.
  const handleRequestSubmitBorang = () => {
    const config = FORMS_CONFIG.find(f=>f.id===openFormId);
    const validationError = validateSubmission(config);
    if (validationError) { setFormMsg({type:"error",text:validationError}); return; }
    setConfirmSubmitBorang(true);
  };

  // Core UC10 handler, shared by both a fresh submission and revising an
  // existing pending one (isEdit): validates, persists the submitter's
  // signature as a data URL (so it survives to be reused when the PDF is
  // regenerated post-approval), then either updates the existing
  // formSubmissions doc in place or creates a new one via submitBorang().
  const handleSubmitBorang = async () => {
    setConfirmSubmitBorang(false);
    const config=FORMS_CONFIG.find(f=>f.id===openFormId);
    const validationError = validateSubmission(config);
    if (validationError) { setFormMsg({type:"error",text:validationError}); return; }
    const isEdit = !!editingSubmissionId;
    const lastKey = `sfms_last_form_${currentUser?.uid}`;
    const last = Number(localStorage.getItem(lastKey) || 0);
    const elapsed = Date.now() - last;
    // The submit-cooldown only guards against spamming new submissions —
    // editing an existing one isn't creating anything new, so it isn't gated by it.
    if (!isEdit && elapsed < FORM_COOLDOWN_MS) {
      const wait = Math.ceil((FORM_COOLDOWN_MS - elapsed) / 1000);
      setFormMsg({type:"error",text:`Sila tunggu ${wait} saat sebelum menghantar borang lagi.`});
      return;
    }
    try {
      setSubmitting(true); setFormMsg({type:"",text:""});
      const finalFormData = buildSubmissionFormData(formData, config);
      const needsSig = config?.sections?.some(s=>s.fields?.some(f=>f.type==="signature"));
      // Persisted (not just used ephemerally for the live PDF preview) so a
      // complete PDF — including this signature — can be regenerated later,
      // e.g. once a reviewer has approved and added their own section.
      const submitterSignature = needsSig ? await resolveToDataUrl(activeSig) : null;
      const contentPayload = {
        formData:finalFormData, ...(config.rowColumns?{rows}:{}),
        suratKelulusanUrl:suratKelulusan?.url ?? null, suratKelulusanName:suratKelulusan?.name ?? null,
        submitterSignature,
        ...(config.allowSubmitToChoice ? { submitTo } : {}),
        ...mandatoryAttachmentPayload(config),
      };
      if (isEdit) {
        await updateBorangFields(editingSubmissionId, contentPayload);
        await loadSubmissions();
        setSubmitSuccessPopup({ kind: "borang-edit", text: "Borang berjaya dikemaskini." });
      } else {
        localStorage.setItem(lastKey, String(Date.now()));
        const createdByClub = localStorage.getItem(`sfms_club_${currentUser.uid}`) || "";
        await submitBorang({
          formType:config.id, formName:config.title, createdBy:currentUser.uid, createdByEmail:currentUser.email, createdByClub,
          ...contentPayload,
        });
        clearDraft(config.id,currentUser.uid); refreshDraftList();
        await loadSubmissions();
        setSubmitSuccessPopup({ kind: "borang", text: "Borang berjaya dihantar untuk kelulusan." });
      }
    } catch (e) { console.error(e); setFormMsg({type:"error",text:`Gagal ${isEdit?"mengemaskini":"menghantar"} borang. ${e?.code ?? e?.message ?? "Sila cuba lagi."}`}); }
    finally { setSubmitting(false); }
  };

  // "OK" on the success popup — dismiss it, and for the digital-form flow also
  // close the form modal now (previously this happened automatically on a
  // timer; now it's tied to the user's explicit acknowledgement instead).
  const handleAcknowledgeSuccess = () => {
    const kind = submitSuccessPopup?.kind;
    setSubmitSuccessPopup(null);
    if (kind === "borang" || kind === "borang-edit") closeForm();
  };

  // "Jana PDF" — generates and downloads a preview of the current form's PDF
  // client-side via its PDF_GENERATORS entry, without submitting anything.
  const handleJanaPdf = async () => {
    const genFn = openFormId ? PDF_GENERATORS[openFormId] : null;
    if (!genFn) return;
    const cfg = FORMS_CONFIG.find(f => f.id === openFormId);
    try {
      setFormMsg({ type: "", text: "" });
      setDownloadingPdf(true);
      const sig = await resolveToDataUrl(activeSig);
      const doc = genFn(buildSubmissionFormData(formData, cfg), rows, sig);
      if (!doc) return;
      const titleSlug = cfg ? cfg.title.replace(/[^a-zA-Z0-9\s]/g,"").trim().replace(/\s+/g,"-").toLowerCase() : "borang";
      const progCode  = progContext?.code ? progContext.code.toUpperCase() : "";
      const filename  = `${titleSlug}${progCode ? `-${progCode}` : ""}.pdf`;
      openPdf(doc, filename);
    } catch (e) {
      console.error(e);
      setFormMsg({ type: "error", text: `Gagal memuat turun PDF. ${e?.message ?? "Sila cuba lagi."}` });
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Once a submission has been approved, the reviewer may have added their
  // own section/signature (config.reviewerSection) — regenerate the PDF with
  // that data merged in so the treasurer can download the complete, final version.
  const handleDownloadUpdatedPdf = async (sub) => {
    const genFn = PDF_GENERATORS[sub.formType];
    const cfg = FORMS_CONFIG.find(f => f.id === sub.formType);
    if (!genFn || !cfg) return;
    setErrorMsg("");
    let doc;
    try {
      const mergedData = { ...sub.formData, ...(sub.reviewerData ?? {}) };
      doc = genFn(mergedData, sub.rows, sub.submitterSignature ?? null);
    } catch (e) {
      console.error(e);
      setErrorMsg(`Gagal memuat turun PDF. ${e?.message ?? "Sila cuba lagi."}`);
      return;
    }
    if (!doc) return;
    const titleSlug = cfg.title.replace(/[^a-zA-Z0-9\s]/g,"").trim().replace(/\s+/g,"-").toLowerCase();
    openPdf(doc, `${titleSlug}-kemaskini.pdf`);
  };

  const handleRequestDirectPdfSubmit = () => {
    if (!directFormType) { setDirectMsg({type:"error",text:"Sila pilih jenis borang."}); return; }
    if (!directFile) { setDirectMsg({type:"error",text:"Sila muat naik fail PDF."}); return; }
    if (!directSubmitTo) { setDirectMsg({type:"error",text:"Sila pilih ke mana borang ini hendak dihantar."}); return; }
    setConfirmDirectSubmit(true);
  };

  // Muat Naik PDF Terus — bendahari uploads a pre-made PDF directly, choosing which
  // form type it represents and where it should be reviewed, bypassing the digital form.
  const handleDirectPdfSubmit = async () => {
    setConfirmDirectSubmit(false);
    if (!directFormType) { setDirectMsg({type:"error",text:"Sila pilih jenis borang."}); return; }
    if (!directFile) { setDirectMsg({type:"error",text:"Sila muat naik fail PDF."}); return; }
    if (!directSubmitTo) { setDirectMsg({type:"error",text:"Sila pilih ke mana borang ini hendak dihantar."}); return; }
    const cfg = FORMS_CONFIG.find(f => f.id === directFormType);
    if (!cfg) return;
    const lastKey = `sfms_last_form_${currentUser?.uid}`;
    const last = Number(localStorage.getItem(lastKey) || 0);
    const elapsed = Date.now() - last;
    if (elapsed < FORM_COOLDOWN_MS) {
      const wait = Math.ceil((FORM_COOLDOWN_MS - elapsed) / 1000);
      setDirectMsg({type:"error",text:`Sila tunggu ${wait} saat sebelum menghantar borang lagi.`});
      return;
    }
    setDirectSubmitting(true); setDirectMsg({type:"",text:""});
    localStorage.setItem(lastKey, String(Date.now()));
    try {
      const createdByClub = localStorage.getItem(`sfms_club_${currentUser.uid}`) || "";
      await submitPdfBorang(currentUser.uid, currentUser.email, createdByClub, cfg.id, cfg.title, directFile, {
        submitTo: directSubmitTo,
        directUpload: true,
      });
      setDirectFormType(""); setDirectFile(null); setDirectSubmitTo(null);
      setSubmitSuccessPopup({ kind: "direct", text: "PDF berjaya dihantar kepada pihak berkenaan." });
    } catch (e) { console.error(e); setDirectMsg({type:"error",text:`Gagal menghantar PDF. ${e?.code ?? e?.message ?? "Sila cuba lagi."}`}); }
    finally { setDirectSubmitting(false); }
  };

  const inputClass = "w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100";
  const fieldClass = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-red-500 focus:ring-1 focus:ring-red-100 placeholder:italic placeholder:text-gray-400";
  const activeFormConfig = FORMS_CONFIG.find(f=>f.id===openFormId);
  const hasPdfGen = openFormId && !!PDF_GENERATORS[openFormId];

  const renderField = (field) => {
    const isAF = getAutoFillValue(field.key, openFormId) !== null;
    const aC = "w-full rounded-lg border border-gray-100 bg-gray-100 px-3 py-2 text-sm text-gray-500 cursor-not-allowed";
    // Auto-filled fields don't need the "required" asterisk — they're already filled in.
    const req = (field.required && !isAF) ? <span className="ml-0.5 text-red-600">*</span> : null;
    if (field.type === "signature") {
      const noSavedSig = (userProfile?.signatures ?? []).length === 0;
      return (
      <div key={field.key} className="sm:col-span-2">
        <label className="mb-2 block text-xs font-medium text-gray-600">{field.label}{req}</label>
        {!activeSig && noSavedSig && (
          <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Anda belum mempunyai tandatangan tersimpan. Sila tambah tandatangan di bawah sebelum menghantar borang.
          </p>
        )}
        <SignaturePanel
          savedSignatures={userProfile?.signatures ?? []}
          uid={currentUser?.uid}
          activeSig={activeSig}
          onActiveSig={setActiveSig}
          onRefresh={refreshProfile}
        />
      </div>
      );
    }
    if (field.key === "alamat") return (
      <div key="alamat" className="sm:col-span-2">
        <label className="mb-2 block text-xs font-medium text-gray-600">{field.label}{req}</label>
        <AddressField formData={formData} onMultiChange={handleMultiFieldChange} fieldClass={fieldClass} uid={currentUser?.uid} />
      </div>
    );
    if (field.type === "info") return (
      <div key={field.key} className="sm:col-span-2 rounded-xl border border-gray-200 bg-gray-50 p-4">
        <ol className="list-decimal space-y-2 pl-4 text-sm text-gray-700">
          {(field.content ?? []).map((line, i) => <li key={i}>{line}</li>)}
        </ol>
      </div>
    );
    if (field.type === "checkbox") return (
      <div key={field.key} className={`sm:col-span-2 flex items-start gap-2 rounded-xl border p-3 ${formData[field.key] ? "border-green-200 bg-green-50" : "border-gray-200 bg-white"}`}>
        <input
          type="checkbox"
          id={`chk-${field.key}`}
          checked={!!formData[field.key]}
          onChange={e=>handleFieldChange(field.key, e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-red-800 focus:ring-red-500"
        />
        <label htmlFor={`chk-${field.key}`} className="text-sm text-gray-700">{field.label}{req}</label>
      </div>
    );
    if (isAF) return (
      <div key={field.key} className={field.key==="organisasi"?"sm:col-span-2":""}>
        <label className="mb-1 block text-xs font-medium text-gray-600">{field.label}{req}</label>
        <input type="text" value={formData[field.key]??""} readOnly className={aC} />
      </div>
    );
    if (field.type === "select") return (
      <div key={field.key}>
        <label className="mb-1 block text-xs font-medium text-gray-600">{field.label}{req}</label>
        <select value={formData[field.key]??""} onChange={e=>handleFieldChange(field.key,e.target.value)} className={fieldClass}>
          <option value="">— Pilih {field.label} —</option>
          {(field.options??[]).map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </div>
    );
    if (field.key === "namapenuh_penerima") return (
      <div key={field.key}>
        <label className="mb-1 block text-xs font-medium text-gray-600">{field.label}{req} <span className="font-normal text-gray-400">(seperti di IC)</span></label>
        <input type="text" value={formData[field.key]??""} onChange={e=>handleFieldChange(field.key,e.target.value.toUpperCase())} className={fieldClass} placeholder="ALI BIN ABU" />
      </div>
    );
    if (field.key === "no_kp_penerima") return (
      <div key={field.key}>
        <label className="mb-1 block text-xs font-medium text-gray-600">{field.label}{req}</label>
        <input type="text" value={formData[field.key]??""} onChange={e=>handleFieldChange(field.key,formatIcNumber(e.target.value))} className={fieldClass} placeholder="XXXXXX-XX-XXXX" maxLength={14} />
      </div>
    );
    if (field.type === "number") return (
      <div key={field.key}>
        <label className="mb-1 block text-xs font-medium text-gray-600">{field.label}{req}</label>
        <input
          type="text"
          inputMode="decimal"
          value={formData[field.key]??""}
          onChange={e=>handleFieldChange(field.key,filterMoneyInput(e.target.value))}
          onBlur={e=>{ const v=e.target.value; if(v!==""&&!isNaN(Number(v))) handleFieldChange(field.key,Number(v).toFixed(2)); }}
          className={fieldClass}
          placeholder={field.placeholder??field.label}
        />
      </div>
    );
    return (
      <div key={field.key} className={field.type==="textarea"?"sm:col-span-2":""}>
        <label className="mb-1 block text-xs font-medium text-gray-600">{field.label}{req}</label>
        {field.type==="textarea"
          ? <textarea rows={2} value={formData[field.key]??""} onChange={e=>handleFieldChange(field.key,e.target.value)} className={fieldClass} placeholder={field.placeholder??field.label} />
          : <input type={field.type} value={formData[field.key]??""} onChange={e=>handleFieldChange(field.key,e.target.value)} className={fieldClass} placeholder={field.type!=="date"?(field.placeholder??field.label):undefined} />}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title={
          forcedTab === "borang"  ? "Borang Kewangan UTM" :
          forcedTab === "laporan" ? "Penyata Kewangan" :
          "Penyata & Borang Kewangan"
        }
        action={<button onClick={handleBack} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-red-900 hover:border-red-900 hover:text-white">Kembali</button>} />

      <div className="mx-auto max-w-7xl space-y-6 p-6">
        {/* Tab switcher — only shown when this page is not pinned to a single tab */}
        {!forcedTab && (
          <div className="flex gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm w-fit">
            {userRole==="treasurer" && (
              <button onClick={()=>setActiveTab("borang")} className={`rounded-lg px-5 py-2 text-sm font-semibold transition ${activeTab==="borang"?"bg-red-900 text-white shadow-sm":"text-gray-600 hover:bg-gray-100"}`}>
                Borang Kewangan UTM
              </button>
            )}
            <button onClick={()=>setActiveTab("laporan")} className={`rounded-lg px-5 py-2 text-sm font-semibold transition ${activeTab==="laporan"?"bg-red-900 text-white shadow-sm":"text-gray-600 hover:bg-gray-100"}`}>
              Penyata Kewangan
            </button>
          </div>
        )}

        {/* ══ TAB: BORANG ══ */}
        {activeTab==="borang" && userRole==="treasurer" && (
          <>
            {/* Workflow chronology banner */}
            <div className="rounded-2xl border border-red-100 bg-white shadow-sm overflow-hidden">
              <div className="bg-red-900 px-6 py-4">
                <p className="text-base font-bold text-white">Aliran Proses Borang Kewangan UTM</p>
              </div>
              <div className="overflow-x-auto px-5 py-6">
                <div className="flex min-w-[580px] items-start">
                  {[
                    { n:"1", label:"Isi Borang Baru", sub:'Tekan "Isi Borang Baru"',          bg:"bg-red-900" },
                    { n:"2", label:"Sudah Dihantar",  sub:"Hantar untuk semakan",              bg:"bg-amber-500" },
                    { n:"3", label:"Sedang Disemak",  sub:"Penasihat Kelab/Pegawai Kewangan membuka borang",  bg:"bg-blue-500" },
                    { n:"4", label:"Diluluskan/Tolak",sub:"Keputusan Penasihat Kelab/Pegawai Kewangan",       bg:"bg-green-600" },
                    { n:"5", label:"Selesai",          sub:"Proses lengkap",                   bg:"bg-purple-600" },
                  ].map((step, i, arr) => (
                    <div key={i} className="flex flex-1 items-start">
                      <div className="flex flex-col items-center gap-2 w-full">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-full ${step.bg} shadow-sm shrink-0`}>
                          <span className="text-base font-bold text-white">{step.n}</span>
                        </div>
                        <p className="text-center text-sm font-semibold text-gray-800 leading-tight px-1">{step.label}</p>
                        <p className="text-center text-xs text-gray-400 leading-tight px-1">{step.sub}</p>
                      </div>
                      {i < arr.length - 1 && (
                        <div className="flex items-center pt-5 shrink-0 w-7">
                          <span className="text-gray-300 text-xl">›</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Draf Borang section — always on top, email-inbox style */}
            <div className="rounded-2xl border border-amber-200 bg-white shadow-sm">
              <button
                onClick={() => setShowDrafts(s => !s)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-amber-50 transition text-left rounded-2xl"
              >
                <div className="flex items-center gap-3">
                  <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7l9 6 9-6" />
                    </svg>
                    {draftList.length > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-0.5 text-[9px] font-bold text-white leading-none">
                        {draftList.length}
                      </span>
                    )}
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-amber-800">Draf Borang</h2>
                    <p className="text-xs text-amber-600 mt-0.5">
                      {draftList.length > 0 ? `${draftList.length} draf belum dihantar` : "Tiada draf tersimpan"}
                    </p>
                  </div>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-amber-500 transition-transform duration-200 ${showDrafts ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showDrafts && (
                draftList.length === 0 ? (
                  <div className="border-t border-amber-100 px-6 py-6 text-center">
                    <p className="text-sm text-gray-400">Tiada draf tersimpan. Tekan &quot;Isi Borang Baru&quot; untuk mula mengisi.</p>
                  </div>
                ) : (
                  <div className="border-t border-amber-100 divide-y divide-gray-100">
                    {draftList.map(({ config, savedAt }) => (
                      <div key={config.id} className="flex items-center justify-between px-6 py-4 hover:bg-amber-50 transition">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{config.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              Disimpan: {savedAt ? new Date(savedAt).toLocaleString("ms-MY",{dateStyle:"medium",timeStyle:"short"}) : "—"}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0 ml-4">
                          <button onClick={()=>openForm(config)} className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600">Teruskan</button>
                          <button onClick={()=>{ clearDraft(config.id,currentUser.uid); refreshDraftList(); }} className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50">Buang</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>

            {/* Muat Naik PDF Terus — upload a pre-made PDF directly instead of filling the digital form */}
            <div className="rounded-2xl border border-blue-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-blue-900">Muat Naik PDF Terus</h2>
              <p className="mt-0.5 mb-4 text-xs text-blue-600">
                Sudah ada borang PDF siap diisi? Muat naik terus di sini tanpa perlu mengisi borang digital.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">1. Jenis Borang</label>
                  <select
                    value={directFormType}
                    onChange={e => { setDirectFormType(e.target.value); setDirectSubmitTo(null); setDirectMsg({type:"",text:""}); }}
                    className={inputClass}
                  >
                    <option value="">— Pilih jenis borang —</option>
                    {FORMS_CONFIG.map((config, idx) => (
                      <option key={config.id} value={config.id}>{idx+1}. {config.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">2. Muat Naik Fail PDF</label>
                  {directFile ? (
                    <div className="flex items-center gap-3">
                      <span className="flex-1 truncate rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-medium text-green-700">✓ {directFile.name}</span>
                      <button type="button" onClick={() => setDirectFile(null)} className="shrink-0 rounded-lg border border-red-200 bg-white px-2.5 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50">✕</button>
                    </div>
                  ) : (
                    <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-100">
                      ↑ Pilih Fail PDF
                      <input type="file" accept="application/pdf" className="hidden" onChange={e=>{ if(e.target.files[0]) { setDirectFile(e.target.files[0]); setDirectMsg({type:"",text:""}); } }} />
                    </label>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700">3. Hantar Kepada</label>
                  <div className="flex gap-3">
                    {(FORMS_CONFIG.find(f => f.id === directFormType)?.submitToOptions ?? ["advisor","pegawai"]).map(value => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setDirectSubmitTo(value)}
                        className={`flex-1 rounded-lg border-2 px-4 py-2.5 text-sm font-semibold transition ${directSubmitTo===value ? "border-blue-600 bg-blue-600 text-white" : "border-blue-200 bg-white text-blue-700 hover:bg-blue-50"}`}
                      >
                        {directSubmitTo===value ? "✓ " : ""}{SUBMIT_TO_LABELS[value]}
                      </button>
                    ))}
                  </div>
                </div>

                {directMsg.text && (
                  <div className={`rounded-xl border px-4 py-3 text-sm ${directMsg.type==="success"?"border-green-200 bg-green-50 text-green-700":"border-red-200 bg-red-50 text-red-700"}`}>
                    {directMsg.text}
                  </div>
                )}

                <button
                  onClick={handleRequestDirectPdfSubmit}
                  disabled={directSubmitting}
                  className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                >
                  {directSubmitting ? "Menghantar..." : "Hantar PDF"}
                </button>
              </div>
            </div>

            {/* Form cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FORMS_CONFIG.map((config, idx) => (
                <div key={config.id} className="flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-800">{idx+1}</span>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 leading-snug">{config.title}</h3>
                      <p className="mt-0.5 text-xs text-gray-500">{config.subtitle}</p>
                    </div>
                  </div>
                  <div className="mt-auto">
                    <button onClick={()=>handleStartNewForm(config)} className="w-full rounded-xl bg-red-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800">
                      Isi Borang Baru
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {errorMsg && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMsg}</div>}

            {/* Status Penyerahan Borang */}
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-6 py-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-red-700">Status Penyerahan Borang</h2>
              </div>
              {loadingSubmissions ? (
                <p className="p-6 text-sm text-gray-500">Memuatkan senarai borang...</p>
              ) : submissions.length===0 ? (
                <p className="p-6 text-sm text-gray-500">Tiada borang dihantar lagi.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-red-900 text-left">
                        {[
                          { col: "borang",  label: "Jenis Borang" },
                          { col: "tarikh",  label: "Tarikh Hantar" },
                          { col: "status",  label: "Status" },
                          { col: "disemak", label: "Disemak Oleh" },
                        ].map(({ col, label }) => (
                          <th key={col} className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => handleSubmissionSort(col)}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-red-100 hover:text-white"
                            >
                              {label}
                              <span className="flex flex-col leading-none">
                                <span className={submissionSort.col===col && submissionSort.dir==="asc" ? "text-white" : "text-red-400"}>▲</span>
                                <span className={submissionSort.col===col && submissionSort.dir==="desc" ? "text-white" : "text-red-400"}>▼</span>
                              </span>
                            </button>
                          </th>
                        ))}
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-red-100">Tindakan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-red-50">
                      {sortedSubmissions.map(sub=>(
                        <tr key={sub.id} className="hover:bg-red-50 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{sub.formName}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{sub.createdAt?.toDate?sub.createdAt.toDate().toLocaleDateString("ms-MY"):"—"}</td>
                          <td className="px-4 py-3"><span className={statusBadge(sub.status)}>{statusLabel(sub.status)}</span></td>
                          <td className="px-4 py-3 text-sm text-gray-500">{reviewerNameFor(sub)||<span className="text-gray-400">—</span>}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              {["menunggu","disemak"].includes(sub.status) && (
                                <button onClick={() => handleEditSubmission(sub)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700">
                                  Sunting
                                </button>
                              )}
                              {PDF_GENERATORS[sub.formType] && (
                                <button onClick={() => handleDownloadUpdatedPdf(sub)} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-green-700">
                                  {sub.status === "diluluskan" ? "Muat Turun PDF Kemaskini" : "Muat Turun PDF"}
                                </button>
                              )}
                              {!["menunggu","disemak"].includes(sub.status) && !PDF_GENERATORS[sub.formType] && (
                                <span className="text-gray-300">—</span>
                              )}
                            </div>
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

        {/* ══ TAB: LAPORAN ══ */}
        {activeTab==="laporan" && (
          <>
            {progContext&&userRole==="treasurer"&&(
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
                Menunjukkan penyata untuk <span className="font-bold">{progContext.code}</span> — {progContext.name}
              </div>
            )}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-red-700">Jana Penyata</h2>

              {/* Filter mode toggle */}
              <div className="mb-5 flex gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 w-fit">
                <button
                  onClick={() => setFilterMode("julat")}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${filterMode==="julat" ? "bg-white text-red-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                >
                  Julat Tarikh
                </button>
                <button
                  onClick={() => setFilterMode("keseluruhan")}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${filterMode==="keseluruhan" ? "bg-white text-red-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                >
                  Keseluruhan Program
                </button>
              </div>

              {userRole === "bendahari_kelab" && (
                <div className="mb-5">
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Program (pilihan — kosongkan untuk semua program)
                  </label>
                  {loadingClubProgrammes ? (
                    <p className="text-sm text-gray-400">Memuatkan senarai program...</p>
                  ) : clubProgrammes.length === 0 ? (
                    <p className="text-sm text-gray-400">Tiada program dijumpai untuk kelab ini.</p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto rounded-xl border border-gray-200 p-3">
                      <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                        {clubProgrammes.map((p) => (
                          <label key={p.id} className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              checked={selectedProgCodes.includes(p.code)}
                              onChange={() => toggleProgCode(p.code)}
                              className="h-4 w-4 rounded border-gray-300 text-red-800 focus:ring-red-500"
                            />
                            <span className="font-semibold text-red-800">{p.code}</span>
                            <span className="truncate text-gray-500">{p.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedProgCodes.length > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <p className="text-xs text-gray-500">{selectedProgCodes.length} program dipilih.</p>
                      <button onClick={() => setSelectedProgCodes([])} className="text-xs font-medium text-red-700 hover:underline">
                        Kosongkan
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <label className={`mb-1.5 block text-sm font-medium ${filterMode==="keseluruhan" ? "text-gray-300" : "text-gray-700"}`}>Tarikh Mula</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e=>setStartDate(e.target.value)}
                    disabled={filterMode==="keseluruhan"}
                    className={`${inputClass} ${filterMode==="keseluruhan" ? "cursor-not-allowed bg-gray-50 text-gray-300" : ""}`}
                  />
                </div>
                <div>
                  <label className={`mb-1.5 block text-sm font-medium ${filterMode==="keseluruhan" ? "text-gray-300" : "text-gray-700"}`}>Tarikh Akhir</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e=>setEndDate(e.target.value)}
                    disabled={filterMode==="keseluruhan"}
                    className={`${inputClass} ${filterMode==="keseluruhan" ? "cursor-not-allowed bg-gray-50 text-gray-300" : ""}`}
                  />
                </div>
                <div className="flex items-end">
                  <button onClick={handleLoadReport} disabled={loading} className="w-full rounded-xl bg-red-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-800 disabled:opacity-60">
                    {loading ? "Memuatkan..." : "Jana Penyata"}
                  </button>
                </div>
                <div className="flex items-end">
                  <button onClick={handleDownloadPdf} disabled={!records.length} className="w-full rounded-xl bg-green-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-green-800 disabled:opacity-60">
                    Muat Turun PDF
                  </button>
                </div>
              </div>

              {filterMode==="keseluruhan" && (
                <p className="mt-3 text-xs text-gray-400">Semua transaksi dalam program akan disertakan tanpa tapis tarikh.</p>
              )}

              {errorMsg&&<div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMsg}</div>}
              {message&&<div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wider text-green-600">Jumlah Pendapatan</p><h2 className="mt-2 text-2xl font-bold text-gray-900">RM {summary.totalIncome.toFixed(2)}</h2></div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wider text-red-600">Jumlah Perbelanjaan</p><h2 className="mt-2 text-2xl font-bold text-gray-900">RM {summary.totalExpense.toFixed(2)}</h2></div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Baki</p><h2 className="mt-2 text-2xl font-bold text-gray-900">RM {summary.balance.toFixed(2)}</h2></div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-red-100 px-6 py-4"><h2 className="text-sm font-semibold uppercase tracking-wider text-red-700">Transaksi Diluluskan</h2></div>
              {!records.length ? <p className="p-6 text-sm text-gray-500">Tiada transaksi dijumpai. Jana penyata terlebih dahulu.</p> : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead><tr className="bg-red-900 text-left">
                      {["Program","Tarikh","Catatan","Kategori","Jenis","Jumlah","Dibuat Oleh"].map(h=>(
                        <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-red-100">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody className="divide-y divide-red-50">
                      {records.map(item=>(
                        <tr key={item.id} className="hover:bg-red-50 transition-colors">
                          <td className="px-4 py-3">{item.programmeCode?(<div><span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">{item.programmeCode}</span><p className="mt-0.5 text-xs text-gray-500">{item.programmeName}</p></div>):<span className="text-xs text-gray-400">—</span>}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{item.date}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{item.description}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{item.category}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{typeLabel(item.type)}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">RM {Number(item.amount||0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{item.createdByEmail}</td>
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

      {/* ══ MODAL: ISI BORANG ══ */}
      {openFormId && activeFormConfig && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-8">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-xl mb-8">
            <div className="sticky top-0 z-10 flex items-start justify-between rounded-t-2xl border-b border-gray-100 bg-white px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  {activeFormConfig.title}
                  {editingSubmissionId && <span className="ml-2 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700 align-middle">Sunting</span>}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">{activeFormConfig.subtitle}</p>
              </div>
              <button onClick={closeForm} className="ml-4 shrink-0 rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700">✕</button>
            </div>

            {hasDraft && (
              <div className="mx-6 mt-4 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
                <p className="text-xs font-medium text-amber-800">Draf dijumpai — maklumat sebelum ini telah dipulihkan secara automatik.</p>
                <button onClick={discardDraft} className="ml-4 shrink-0 text-xs font-semibold text-amber-700 underline hover:text-amber-900">Buang Draf</button>
              </div>
            )}

            <div className="px-6 py-5 space-y-6">
              {activeFormConfig.sections && <p className="text-xs text-gray-400"><span className="font-bold text-red-600">*</span> Medan bertanda wajib diisi</p>}
              {(() => {
                const hasRowSection = activeFormConfig.sections?.some(s=>s.isRowSection);
                const hasSignatureInSection = activeFormConfig.sections?.some(s=>s.fields?.some(f=>f.type==="signature"));
                return (
                  <>
                    {activeFormConfig.sections
                      ? activeFormConfig.sections.map(section=>(
                          <div key={section.id}>
                            <div className="mb-3 flex items-center gap-2">
                              <span className={`flex h-6 items-center justify-center rounded-full bg-red-900 text-xs font-bold text-white ${section.id.length>2?"px-3":"w-6"}`}>{section.id}</span>
                              <h4 className="text-sm font-bold text-gray-800">{section.label}</h4>
                              {!section.required && <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-500">Pilihan</span>}
                            </div>
                            {section.isRowSection ? (
                              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                {section.rowSectionFields && (
                                  <div className="mb-4 grid gap-3 sm:grid-cols-2">
                                    {section.rowSectionFields.map(renderField)}
                                  </div>
                                )}
                                <div className="mb-2 flex items-center justify-between">
                                  <p className="text-xs text-gray-500">
                                    {activeFormConfig.rowsAutoFromTransactions
                                      ? `${rows.length} transaksi perbelanjaan direkodkan`
                                      : activeFormConfig.fixedRowCount ? `${rows.length} entri (tetap pada ${activeFormConfig.fixedRowCount})` : `${rows.length} entri`}
                                  </p>
                                  {!activeFormConfig.fixedRowCount && !activeFormConfig.rowsAutoFromTransactions && (
                                    <button type="button" onClick={addRow} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100">+ Tambah Penyumbang</button>
                                  )}
                                </div>
                                {activeFormConfig.rowsAutoFromTransactions ? (
                                  <div className="overflow-x-auto rounded-xl border border-gray-200">
                                    <table className="min-w-full text-xs">
                                      <thead className="bg-gray-50">
                                        <tr>
                                          <th className="px-3 py-2 text-left font-semibold text-gray-500">Bil</th>
                                          {activeFormConfig.rowColumns.map(col=><th key={col.key} className="px-3 py-2 text-left font-semibold text-gray-500">{col.label}</th>)}
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100">
                                        {rows.length === 0 ? (
                                          <tr><td colSpan={activeFormConfig.rowColumns.length+1} className="px-3 py-4 text-center italic text-gray-400">Tiada transaksi perbelanjaan direkodkan untuk program ini.</td></tr>
                                        ) : rows.map((row,ri)=>(
                                          <tr key={ri}>
                                            <td className="px-3 py-2 font-medium text-gray-500">{ri+1}</td>
                                            {activeFormConfig.rowColumns.map(col=>(
                                              <td key={col.key} className="px-3 py-2 text-gray-800">{row[col.key] || <span className="italic text-gray-400">—</span>}</td>
                                            ))}
                                          </tr>
                                        ))}
                                      </tbody>
                                      {rows.length > 0 && (
                                        <tfoot>
                                          <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold text-gray-800">
                                            <td className="px-3 py-2 text-right" colSpan={activeFormConfig.rowColumns.length}>Jumlah Keseluruhan (RM)</td>
                                            <td className="px-3 py-2">RM {rows.reduce((s,r)=>s+Number(r.jumlah||0),0).toFixed(2)}</td>
                                          </tr>
                                        </tfoot>
                                      )}
                                    </table>
                                  </div>
                                ) : (
                                <div className="overflow-x-auto rounded-xl border border-gray-200">
                                  <table className="min-w-full text-xs">
                                    <thead className="bg-gray-50">
                                      <tr>
                                        <th className="px-3 py-2 text-left font-semibold text-gray-500">Bil</th>
                                        {activeFormConfig.rowColumns.map(col=><th key={col.key} className="px-3 py-2 text-left font-semibold text-gray-500">{col.label}</th>)}
                                        <th className="px-3 py-2"></th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {rows.map((row,ri)=>(
                                        <tr key={ri}>
                                          <td className="px-3 py-2 font-medium text-gray-500">{ri+1}</td>
                                          {activeFormConfig.rowColumns.map(col=>(
                                            <td key={col.key} className="px-3 py-1.5">
                                              <div
                                                onClick={()=>{
                                                  if (col.inputType==="address") {
                                                    const p=parseAlamatPenuh(row[col.key]??"");
                                                    setCellPopout({ri,key:col.key,label:col.label,placeholder:col.placeholder,inputType:"address",
                                                      addr:{alamat_1:p.baris1,alamat_2:p.baris2,alamat_poskod:p.poskod,alamat_bandar:p.bandar,alamat_negeri:p.negeri,alamat:row[col.key]??""}});
                                                  } else {
                                                    setCellPopout({ri,key:col.key,label:col.label,placeholder:col.placeholder,inputType:col.inputType||"text",tempValue:row[col.key]??""});
                                                  }
                                                }}
                                                className="min-w-[100px] cursor-pointer rounded border border-gray-200 px-2 py-1.5 text-xs transition hover:border-red-300 hover:bg-red-50"
                                              >
                                                {row[col.key]
                                                  ? <span className="text-gray-800">{row[col.key]}</span>
                                                  : <span className="italic text-gray-400">{col.placeholder??col.label}</span>}
                                              </div>
                                            </td>
                                          ))}
                                          <td className="px-3 py-1.5">
                                            <div className="flex gap-1">
                                              <button type="button" onClick={()=>handleRowConfirmClick(ri,row,activeFormConfig)} title="Sahkan baris ini" className="rounded p-1 text-gray-400 hover:bg-green-50 hover:text-green-600">✓</button>
                                              {rows.length>1&&!activeFormConfig.fixedRowCount&&<button type="button" onClick={()=>handleRowRemoveClick(ri,row,activeFormConfig)} title="Buang baris ini" className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600">✕</button>}
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                                )}
                              </div>
                            ) : (
                              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                <div className="grid gap-4 sm:grid-cols-2">{section.fields.map(renderField)}</div>
                              </div>
                            )}
                          </div>
                        ))
                      : <div className="grid gap-4 sm:grid-cols-2">{activeFormConfig.fields.map(renderField)}</div>
                    }

                    {activeFormConfig.rowColumns && !hasRowSection && (
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Senarai Baris</p>
                          <button type="button" onClick={addRow} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100">+ Tambah Baris</button>
                        </div>
                        <div className="overflow-x-auto rounded-xl border border-gray-200">
                          <table className="min-w-full text-xs">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 py-2 text-left font-semibold text-gray-500">Bil</th>
                                {activeFormConfig.rowColumns.map(col=><th key={col.key} className="px-3 py-2 text-left font-semibold text-gray-500">{col.label}</th>)}
                                <th className="px-3 py-2"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {rows.map((row,ri)=>(
                                <tr key={ri}>
                                  <td className="px-3 py-2 font-medium text-gray-500">{ri+1}</td>
                                  {activeFormConfig.rowColumns.map(col=>(
                                    <td key={col.key} className="px-3 py-1.5">
                                      <input type="text" value={row[col.key]??""} onChange={e=>handleRowChange(ri,col.key,e.target.value)} className="w-full min-w-[100px] rounded border border-gray-200 px-2 py-1 text-xs italic placeholder:text-gray-400 outline-none focus:border-red-400" placeholder={col.placeholder??col.label} />
                                    </td>
                                  ))}
                                  <td className="px-3 py-1.5">{rows.length>1&&<button type="button" onClick={()=>removeRow(ri)} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600">✕</button>}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* ── Surat Kelulusan Program ── */}
                    {!activeFormConfig.hideSuratKelulusan && (
                      <div className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 p-4">
                        <div className="mb-1.5 flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-amber-900">Surat Kelulusan Program</span>
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">Pilihan</span>
                        </div>
                        <p className="mb-3 text-xs text-amber-700">Muat naik surat kelulusan program jika ada. (PDF atau imej diterima)</p>
                        {suratKelulusan?.url ? (
                          <div className="flex items-center gap-3">
                            <span className="flex-1 truncate rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-medium text-green-700">✓ {suratKelulusan.name}</span>
                            <label className="cursor-pointer rounded-lg border border-amber-400 bg-white px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-50">
                              Tukar
                              <input type="file" accept="application/pdf,image/*" className="hidden" onChange={e=>{if(e.target.files[0])handleSuratUpload(e.target.files[0]);}} />
                            </label>
                          </div>
                        ) : suratKelulusan?.uploading ? (
                          <div className="flex items-center gap-2 text-xs text-amber-700">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                            Memuat naik...
                          </div>
                        ) : (
                          <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-amber-300 bg-white px-4 py-3 text-xs font-semibold text-amber-700 transition hover:bg-amber-50">
                            ↑ Pilih & Muat Naik Surat Kelulusan
                            <input type="file" accept="application/pdf,image/*" className="hidden" onChange={e=>{if(e.target.files[0])handleSuratUpload(e.target.files[0]);}} />
                          </label>
                        )}
                      </div>
                    )}

                    {/* ── Lampiran (config.mandatoryAttachments) ── */}
                    {(activeFormConfig.mandatoryAttachments ?? []).map(att => {
                      const files = mandatoryFiles[att.key] ?? [];
                      const atCap = att.maxFiles && files.length >= att.maxFiles;
                      return (
                      <div key={att.key} className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 p-4">
                        <div className="mb-1.5 flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-amber-900">{att.label}</span>
                          {att.required === false ? (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">Pilihan</span>
                          ) : (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Wajib</span>
                          )}
                          {att.maxFiles && <span className="text-xs text-amber-600">({files.length}/{att.maxFiles} fail)</span>}
                        </div>
                        <p className="mb-3 text-xs text-amber-700">{att.hint}</p>
                        <div className="space-y-2">
                          {files.map(f => (
                            <div key={f.id} className="flex items-center gap-3">
                              {f.uploading ? (
                                <div className="flex flex-1 items-center gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-amber-700">
                                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                                  Memuat naik {f.name}...
                                </div>
                              ) : (
                                <span className="flex-1 truncate rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-medium text-green-700">✓ {f.name}</span>
                              )}
                              <button type="button" onClick={() => removeMandatoryAttachment(att.key, f.id)} className="shrink-0 rounded-lg border border-red-200 bg-white px-2.5 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50">✕</button>
                            </div>
                          ))}
                        </div>
                        {atCap ? (
                          <p className="mt-2 text-xs italic text-amber-600">Had maksimum fail telah dicapai. Padam satu fail untuk muat naik yang baru.</p>
                        ) : (
                          <label className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-amber-300 bg-white px-4 py-3 text-xs font-semibold text-amber-700 transition hover:bg-amber-50">
                            ↑ Pilih & Muat Naik Fail
                            <input type="file" accept={att.accept ?? "application/pdf,image/*"} className="hidden" onChange={e=>{if(e.target.files[0])handleMandatoryAttachmentUpload(e.target.files[0], att.key);e.target.value="";}} />
                          </label>
                        )}
                      </div>
                      );
                    })}

                    {/* ── Tandatangan untuk PDF ── */}
                    {hasPdfGen && !hasSignatureInSection && (
                      <SignaturePanel
                        savedSignatures={userProfile?.signatures ?? []}
                        uid={currentUser?.uid}
                        activeSig={activeSig}
                        onActiveSig={setActiveSig}
                        onRefresh={refreshProfile}
                      />
                    )}
                  </>
                );
              })()}

              {/* ── Hantar Kepada (config.allowSubmitToChoice) ── */}
              {activeFormConfig.allowSubmitToChoice && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-indigo-900">
                    Hantar Kepada <span className="font-bold text-red-600">*</span>
                  </p>
                  <div className="flex gap-3">
                    {(activeFormConfig.submitToOptions ?? ["advisor","pegawai"]).map(value => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setSubmitTo(value)}
                        className={`flex-1 rounded-lg border-2 px-4 py-2.5 text-sm font-semibold transition ${submitTo===value ? "border-indigo-600 bg-indigo-600 text-white" : "border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-100"}`}
                      >
                        {submitTo===value ? "✓ " : ""}{SUBMIT_TO_LABELS[value]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {formMsg.text && (
                <div className={`rounded-xl border px-4 py-3 text-sm ${formMsg.type==="success"?"border-green-200 bg-green-50 text-green-700":"border-red-200 bg-red-50 text-red-700"}`}>
                  {formMsg.text}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-3 rounded-b-2xl border-t border-gray-100 bg-gray-50 px-6 py-4">
              <button onClick={handleRequestSubmitBorang} disabled={submitting} className="flex-1 rounded-xl bg-red-900 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-60">
                {submitting ? (editingSubmissionId ? "Mengemaskini..." : "Menghantar...") : (editingSubmissionId ? "Kemaskini Borang" : "Hantar Borang")}
              </button>
              {hasPdfGen && (
                <button onClick={handleJanaPdf} disabled={downloadingPdf} className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${activeSig?"border-green-600 bg-green-600 text-white hover:bg-green-700":"border-green-600 bg-white text-green-700 hover:bg-green-50"}`} title={activeSig?"Muat turun PDF":"Muat turun PDF (tiada tandatangan)"}>
                  {downloadingPdf ? "Memuat turun..." : `Muat Turun PDF${activeSig ? " ✓" : ""}`}
                </button>
              )}
              <button onClick={closeForm} className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100">Batal</button>
            </div>

            {/* ── CellPopout Modal ── */}
            {cellPopout && (
              <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
                <div className={`w-full rounded-2xl bg-white p-6 shadow-xl ${cellPopout.inputType==="address"?"max-w-md":"max-w-sm"}`}>
                  <h3 className="mb-3 text-sm font-bold text-gray-900">{cellPopout.label}</h3>

                  {cellPopout.inputType === "address" ? (
                    <AddressField
                      formData={cellPopout.addr}
                      onMultiChange={(updates)=>setCellPopout(p=>({...p,addr:{...p.addr,...updates}}))}
                      fieldClass={fieldClass}
                    />
                  ) : cellPopout.inputType === "date" ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={cellPopout.tempValue}
                        onChange={e=>setCellPopout(p=>({...p,tempValue:formatDateTyped(e.target.value)}))}
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100 placeholder:italic placeholder:text-gray-400"
                        placeholder={cellPopout.placeholder??"cth. 2025-04-01"}
                        maxLength={10}
                        autoFocus
                      />
                      <div className="flex items-center gap-2">
                        <span className="shrink-0 text-xs text-gray-400">atau pilih dari kalendar:</span>
                        <input
                          type="date"
                          value={cellPopout.tempValue}
                          onChange={e=>setCellPopout(p=>({...p,tempValue:e.target.value}))}
                          className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                        />
                      </div>
                    </div>
                  ) : cellPopout.inputType === "money" ? (
                    <input
                      type="text"
                      inputMode="decimal"
                      value={cellPopout.tempValue}
                      onChange={e=>setCellPopout(p=>({...p,tempValue:filterMoneyInput(e.target.value)}))}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100 placeholder:italic placeholder:text-gray-400"
                      placeholder={cellPopout.placeholder??"0.00"}
                      autoFocus
                    />
                  ) : cellPopout.inputType === "uppercase" ? (
                    <input
                      type="text"
                      value={cellPopout.tempValue}
                      onChange={e=>setCellPopout(p=>({...p,tempValue:e.target.value.toUpperCase()}))}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100 placeholder:italic placeholder:text-gray-400"
                      placeholder={cellPopout.placeholder??cellPopout.label}
                      autoFocus
                    />
                  ) : (
                    <textarea
                      value={cellPopout.tempValue}
                      onChange={e=>setCellPopout(p=>({...p,tempValue:e.target.value}))}
                      className="min-h-[100px] w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100 placeholder:italic placeholder:text-gray-400"
                      placeholder={cellPopout.placeholder??cellPopout.label}
                      autoFocus
                    />
                  )}

                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={()=>{
                        if (cellPopout.inputType==="address") {
                          handleRowChange(cellPopout.ri,cellPopout.key,cellPopout.addr.alamat);
                        } else if (cellPopout.inputType==="money") {
                          const n = Number(cellPopout.tempValue);
                          handleRowChange(cellPopout.ri,cellPopout.key, cellPopout.tempValue!==""&&!isNaN(n) ? n.toFixed(2) : "");
                        } else {
                          handleRowChange(cellPopout.ri,cellPopout.key,cellPopout.tempValue);
                        }
                        setCellPopout(null);
                      }}
                      className="flex-1 rounded-xl bg-red-900 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800"
                    >Selesai</button>
                    <button
                      onClick={()=>setCellPopout(null)}
                      className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
                    >Batal</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Existing draft prompt (before starting a "new" form) ── */}
      {existingDraftPrompt && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
              <svg className="h-7 w-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h3 className="mb-2 text-base font-bold text-gray-900">Draf Belum Selesai Dijumpai</h3>
            <p className="mb-6 text-sm text-gray-500">
              Anda mempunyai draf belum selesai untuk <span className="font-semibold text-gray-800">{existingDraftPrompt.config.title}</span>. Adakah anda ingin menyambung draf tersebut, atau mula borang baru (draf lama akan dibuang)?
            </p>
            <div className="flex flex-col gap-2">
              <button onClick={handleContinueExistingDraft} className="w-full rounded-xl bg-red-900 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800">
                Sambung Draf Sebelum Ini
              </button>
              <button onClick={handleDiscardExistingDraft} className="w-full rounded-xl border border-red-200 bg-white py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50">
                Mula Borang Baru (Buang Draf)
              </button>
              <button onClick={() => setExistingDraftPrompt(null)} className="w-full rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm submit borang ── */}
      {confirmSubmitBorang && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
              <svg className="h-7 w-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h3 className="mb-2 text-base font-bold text-gray-900">{editingSubmissionId ? "Sahkan Kemaskini Borang?" : "Sahkan Penghantaran Borang?"}</h3>
            <p className="mb-6 text-sm text-gray-500">
              Borang <span className="font-semibold text-gray-800">{activeFormConfig?.title}</span> {editingSubmissionId ? "akan dikemaskini." : "akan dihantar untuk kelulusan."} Semak semula sebelum menghantar.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmSubmitBorang(false)} className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">Batal</button>
              <button onClick={handleSubmitBorang} disabled={submitting} className="flex-1 rounded-xl bg-red-900 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-60">
                {submitting ? (editingSubmissionId ? "Mengemaskini..." : "Menghantar...") : (editingSubmissionId ? "Ya, Kemaskini" : "Ya, Hantar")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm direct PDF submit ── */}
      {confirmDirectSubmit && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
              <svg className="h-7 w-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h3 className="mb-2 text-base font-bold text-gray-900">Sahkan Penghantaran PDF?</h3>
            <p className="mb-6 text-sm text-gray-500">
              PDF ini akan dihantar kepada <span className="font-semibold text-gray-800">{SUBMIT_TO_LABELS[directSubmitTo]}</span>. Semak semula sebelum menghantar.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDirectSubmit(false)} className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">Batal</button>
              <button onClick={handleDirectPdfSubmit} disabled={directSubmitting} className="flex-1 rounded-xl bg-red-900 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-60">
                {directSubmitting ? "Menghantar..." : "Ya, Hantar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Submission success popup — dismissed only by explicit "OK" ── */}
      {submitSuccessPopup && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75l2.25 2.25L15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="mb-2 text-base font-bold text-gray-900">Berjaya!</h3>
            <p className="mb-6 text-sm text-gray-500">{submitSuccessPopup.text}</p>
            <button onClick={handleAcknowledgeSuccess} className="w-full rounded-xl bg-red-900 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800">
              OK
            </button>
          </div>
        </div>
      )}

      {/* ── Confirm row add/remove popup ── */}
      {confirmRowAction && (() => {
        const isRemove = confirmRowAction.type === "remove";
        const noun = activeFormConfig?.id === "penyerahan-cek-wang-tunai" ? "penyumbang" : "entri";
        return (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
              <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${isRemove ? "bg-red-100" : "bg-green-100"}`}>
                {isRemove ? (
                  <svg className="h-7 w-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                  </svg>
                ) : (
                  <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <h3 className="mb-2 text-base font-bold text-gray-900">
                {isRemove ? `Buang ${noun} ini?` : `Sahkan Tambah ${noun[0].toUpperCase()+noun.slice(1)}?`}
              </h3>
              {confirmRowAction.label && (
                <p className="mb-6 text-sm text-gray-500"><span className="font-semibold text-gray-800">{confirmRowAction.label}</span></p>
              )}
              <div className="flex gap-3">
                <button onClick={()=>setConfirmRowAction(null)} className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">Batal</button>
                <button
                  onClick={handleRowActionConfirmed}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition ${isRemove ? "bg-red-600 hover:bg-red-700" : "bg-red-900 hover:bg-red-800"}`}
                >
                  {isRemove ? "Ya, Buang" : "Ya, Sahkan"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Row action success popup ── */}
      {rowActionSuccess && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="mb-2 text-base font-bold text-gray-900">Berjaya</h3>
            <p className="mb-6 text-sm text-gray-500">{rowActionSuccess}</p>
            <button onClick={()=>setRowActionSuccess("")} className="w-full rounded-xl bg-red-900 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800">
              Okay
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
