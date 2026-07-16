import { useState } from "react";
import { saveSignature, deleteSignature } from "../services/signatureService";
import { ref as storageRef, getBlob } from "firebase/storage";
import { storage } from "../firebase/config";

export const CHECKERBOARD_BG = "bg-[repeating-conic-gradient(#e5e7eb_0%_25%,#f9fafb_0%_50%)] bg-[length:16px_16px]";

// A plain fetch() to a Storage download URL doesn't carry the user's Firebase
// Auth token, so it gets treated as unauthenticated and denied by Storage
// rules — use the SDK's getBlob() instead, which authenticates properly.
export async function resolveToDataUrl(sig) {
  if (!sig || sig.startsWith("data:")) return sig;
  const blob = await getBlob(storageRef(storage, sig));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(reader.error || new Error("Failed to read signature blob"));
    reader.readAsDataURL(blob);
  });
}

function removeBackground(ctx, w, h, threshold = 200) {
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = d[i] * 0.299 + d[i+1] * 0.587 + d[i+2] * 0.114;
    if (lum > threshold) { d[i+3] = 0; }
    else { d[i] = 0; d[i+1] = 0; d[i+2] = 0; }
  }
  ctx.putImageData(imgData, 0, 0);
}

function findBounds(ctx, w, h) {
  const d = ctx.getImageData(0, 0, w, h).data;
  let minX = w, maxX = 0, minY = h, maxY = 0, found = false;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 10) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        found = true;
      }
    }
  }
  return found ? { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } : null;
}

function ImageSigModal({ uid, onUse, onCancel, onRefresh }) {
  const [imgSrc, setImgSrc]       = useState(null);
  const [threshold, setThreshold] = useState(200);
  const [preview, setPreview]     = useState(null);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [fileError, setFileError] = useState("");

  const processImage = (src, thresh) => {
    setProcessing(true);
    const img = new Image();
    img.onload = () => {
      // Draw full image, remove background, find signature bounds
      const tmp = document.createElement("canvas");
      tmp.width = img.width; tmp.height = img.height;
      const tctx = tmp.getContext("2d");
      tctx.drawImage(img, 0, 0);
      removeBackground(tctx, img.width, img.height, thresh);
      const bounds = findBounds(tctx, img.width, img.height);

      const OUT_W = 800, OUT_H = 200;
      const out = document.createElement("canvas");
      out.width = OUT_W; out.height = OUT_H;
      const octx = out.getContext("2d");

      if (bounds) {
        // Add 5% padding around detected signature
        const pad = Math.round(Math.min(bounds.w, bounds.h) * 0.05);
        const sx = Math.max(0, bounds.x - pad);
        const sy = Math.max(0, bounds.y - pad);
        const sw = Math.min(img.width - sx, bounds.w + pad * 2);
        const sh = Math.min(img.height - sy, bounds.h + pad * 2);
        // Fit within output canvas preserving aspect ratio (no stretch)
        const scale = Math.min(OUT_W / sw, OUT_H / sh);
        const dw = sw * scale, dh = sh * scale;
        octx.drawImage(tmp, sx, sy, sw, sh, (OUT_W - dw) / 2, (OUT_H - dh) / 2, dw, dh);
      } else {
        // Nothing detected — fit entire image
        const scale = Math.min(OUT_W / img.width, OUT_H / img.height);
        const dw = img.width * scale, dh = img.height * scale;
        octx.drawImage(tmp, 0, 0, img.width, img.height, (OUT_W - dw) / 2, (OUT_H - dh) / 2, dw, dh);
      }
      setPreview(out.toDataURL("image/png"));
      setProcessing(false);
    };
    img.src = src;
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setFileError("Tandatangan hanya boleh dimuat naik dalam bentuk imej (PNG, JPG, WEBP).");
      e.target.value = "";
      return;
    }
    setFileError("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImgSrc(ev.target.result);
      setPreview(null);
      processImage(ev.target.result, threshold);
    };
    reader.readAsDataURL(file);
  };

  const handleUse = async (saveSlot) => {
    if (!preview) return;
    if (saveSlot && uid) {
      setSaving(true);
      try { await saveSignature(uid, saveSlot, preview); await onRefresh(); } catch {}
      finally { setSaving(false); }
    }
    onUse(preview);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl overflow-y-auto max-h-[92vh]">
        <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-900">Upload Imej Tandatangan</h3>
            <p className="text-xs text-gray-500 mt-0.5">Latar belakang dibuang &amp; kawasan tandatangan dikesan secara automatik.</p>
          </div>
          <button onClick={onCancel} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">✕</button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* File picker — always visible so user can swap image */}
          <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 py-8 cursor-pointer hover:border-red-400 hover:bg-red-50 transition">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-9 w-9 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            <p className="text-sm font-medium text-gray-500">{imgSrc ? "Klik untuk tukar imej" : "Klik untuk pilih imej tandatangan"}</p>
            <p className="text-xs text-gray-400">PNG, JPG, WEBP sahaja — latar putih atau berwarna diterima</p>
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFile} />
          </label>

          {fileError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{fileError}</div>
          )}

          {imgSrc && (
            <>
              {/* Threshold slider + regenerate */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Kepekaan buang latar: <span className="font-bold text-red-700">{threshold}</span>
                  <span className="ml-1 font-normal text-gray-400">(lebih tinggi = lebih banyak warna dibuang)</span>
                </label>
                <div className="flex items-center gap-3">
                  <input type="range" min={50} max={240} value={threshold} onChange={e => setThreshold(Number(e.target.value))} className="flex-1 accent-red-800" />
                  <button onClick={() => processImage(imgSrc, threshold)} disabled={processing} className="shrink-0 rounded-xl bg-red-900 px-4 py-2 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-60 transition">
                    {processing ? "Memproses..." : "Jana Semula"}
                  </button>
                </div>
              </div>

              {/* Processing state */}
              {processing && (
                <div className="flex h-20 items-center justify-center rounded-xl border border-gray-200 bg-gray-50">
                  <p className="text-xs text-gray-400">Memproses imej...</p>
                </div>
              )}

              {/* Preview */}
              {preview && !processing && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-gray-600">Pratonton tandatangan (latar telus):</p>
                  <div className={`flex h-24 w-full items-center justify-center rounded-xl border border-gray-200 p-2 ${CHECKERBOARD_BG}`}>
                    <img src={preview} alt="Preview tandatangan" className="max-h-full max-w-full object-contain" />
                  </div>
                  <p className="text-xs font-semibold text-gray-600">Simpan / guna tandatangan ini:</p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => handleUse(1)} disabled={saving} className="rounded-lg bg-red-900 px-4 py-2 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-60 transition">
                      {saving ? "Menyimpan..." : "Simpan & Guna"}
                    </button>
                    <button onClick={() => handleUse(null)} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition">
                      Guna Tanpa Simpan
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end rounded-b-2xl border-t border-gray-100 bg-gray-50 px-6 py-4">
          <button onClick={onCancel} className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition">Batal</button>
        </div>
      </div>
    </div>
  );
}

// ─── Signature panel (inline, reused by both the treasurer's form modal and the reviewer's approval screen) ──
export function SignaturePanel({ savedSignatures = [], uid, activeSig, onActiveSig, onRefresh }) {
  const [deleting, setDeleting]         = useState(null);
  const [showImgModal, setShowImgModal] = useState(false);
  const [showSaved, setShowSaved]       = useState(false);
  const [lightbox, setLightbox]         = useState(false);

  const handleDelete = async (slot) => {
    setDeleting(slot);
    try { await deleteSignature(uid, slot); await onRefresh(); } catch (e) { console.error(e); }
    finally { setDeleting(null); }
  };

  const slot1 = savedSignatures.find((s) => s.slot === 1);
  const sigSrc = (data) => data?.url ?? data?.dataUrl ?? null;

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Muat Naik Tandatangan</p>
        {activeSig && <span className="text-xs font-semibold text-green-600">✓ Tandatangan dipilih</span>}
      </div>

      {/* Active signature preview — enlarged, transparency-aware */}
      {activeSig && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => setLightbox(true)}
              title="Klik untuk lihat lebih besar"
              className={`h-24 w-48 shrink-0 rounded-lg border border-white p-1.5 ${CHECKERBOARD_BG} transition hover:ring-2 hover:ring-green-400`}
            >
              <img src={activeSig} alt="Tandatangan aktif" className="h-full w-full object-contain" />
            </button>
            <div className="flex-1 pt-1">
              <p className="text-xs font-medium text-green-700">Tandatangan ini akan digunakan pada borang.</p>
              <button onClick={() => onActiveSig(null)} className="mt-1.5 text-xs text-red-500 underline hover:text-red-700">Tukar tandatangan</button>
            </div>
          </div>
        </div>
      )}

      {/* Enlarged lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4" onClick={() => setLightbox(false)}>
          <div className={`max-h-[80vh] max-w-2xl rounded-2xl border border-white/20 p-4 ${CHECKERBOARD_BG}`}>
            <img src={activeSig} alt="Tandatangan (besar)" className="max-h-[70vh] max-w-full object-contain" />
          </div>
        </div>
      )}

      {/* Saved signature — minimized behind a toggle */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <button
          type="button"
          onClick={() => setShowSaved(s => !s)}
          className="flex w-full items-center justify-between px-3 py-2 text-left"
        >
          <span className="text-xs font-semibold text-gray-500">
            Tandatangan Tersimpan {slot1 ? <span className="text-green-600">(ada)</span> : <span className="text-gray-300">(kosong)</span>}
          </span>
          <span className={`text-xs text-gray-400 transition-transform ${showSaved ? "rotate-180" : ""}`}>▾</span>
        </button>
        {showSaved && (
          <div className="flex flex-col items-center gap-2 border-t border-gray-100 p-2">
            <div className={`flex h-16 w-full items-center justify-center rounded border border-gray-100 ${CHECKERBOARD_BG}`}>
              {slot1 ? <img src={sigSrc(slot1)} alt="Tandatangan" className="h-full w-full object-contain p-1" /> : <span className="text-xs text-gray-400">Kosong</span>}
            </div>
            <div className="flex gap-1.5">
              {slot1 ? (
                <>
                  <button
                    onClick={() => onActiveSig(activeSig === sigSrc(slot1) ? null : sigSrc(slot1))}
                    className={`rounded px-2 py-1 text-xs font-semibold transition ${activeSig === sigSrc(slot1) ? "bg-green-600 text-white" : "bg-red-900 text-white hover:bg-red-800"}`}
                  >
                    {activeSig === sigSrc(slot1) ? "✓ Dipilih" : "Guna"}
                  </button>
                  <button onClick={() => setShowImgModal(true)} className="rounded border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-500 hover:bg-gray-100 transition">
                    Tukar
                  </button>
                  <button onClick={() => handleDelete(1)} disabled={deleting === 1} className="rounded border border-red-200 bg-white px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 transition">
                    {deleting === 1 ? "..." : "Padam"}
                  </button>
                </>
              ) : (
                <button onClick={() => setShowImgModal(true)} className="rounded border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-500 hover:bg-gray-100 transition">
                  Tambah
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Upload button */}
      {!slot1 && (
        <button onClick={() => setShowImgModal(true)} className="w-full rounded-lg border border-dashed border-blue-200 py-2 text-xs font-medium text-blue-600 transition hover:border-blue-400 hover:bg-blue-50">
          + Muat Naik Imej Tandatangan
        </button>
      )}

      {/* Image upload modal */}
      {showImgModal && (
        <ImageSigModal
          uid={uid}
          onUse={(dataUrl) => { onActiveSig(dataUrl); setShowImgModal(false); }}
          onCancel={() => setShowImgModal(false)}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
}
