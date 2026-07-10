import { storage, db } from "../firebase/config";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { addDoc, collection, deleteDoc, getDocs, query, where, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { CLUB_CATEGORIES } from "../config/clubsConfig";

const categoryForClub = (club) => {
  if (!club) return "";
  const entry = Object.entries(CLUB_CATEGORIES).find(([, clubs]) => clubs.includes(club));
  return entry?.[0] ?? "";
};

// Upload PDF blob to Firebase Storage and record submission in Firestore
export async function submitPdfBorang(uid, email, club, formType, formName, pdfBlob, extraData = {}) {
  const path = `pdf_submissions/${formType}/${uid}/${Date.now()}.pdf`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, pdfBlob, { contentType: "application/pdf" });
  const pdfUrl = await getDownloadURL(storageRef);

  await addDoc(collection(db, "pdfSubmissions"), {
    formType,
    formName,
    createdBy:         uid,
    createdByEmail:    email,
    createdByClub:     club || "",
    createdByCategory: categoryForClub(club),
    pdfUrl,
    pdfPath:        path,
    status:         "menunggu",
    createdAt:      serverTimestamp(),
    ...extraData,
  });

  return pdfUrl;
}

// Admin — every PDF submission in the system, all statuses, unrestricted
export async function getAllPdfSubmissions() {
  const snap = await getDocs(collection(db, "pdfSubmissions"));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
}

// Admin — sees everything, unrestricted
export async function getPdfSubmissions() {
  const snap = await getDocs(query(collection(db, "pdfSubmissions"), where("status", "==", "menunggu")));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
}

// Bendahari Kelab — every PDF submitted within their one club, regardless of
// who it's addressed to
export async function getPdfSubmissionsByClub(club) {
  if (!club) return [];
  const snap = await getDocs(
    query(collection(db, "pdfSubmissions"), where("status", "==", "menunggu"), where("createdByClub", "==", club))
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
}

// Advisor — every PDF submitted within one or more assigned clubs, regardless
// of who it's addressed to
export async function getPdfSubmissionsByClubs(clubs) {
  if (!clubs || clubs.length === 0) return [];
  const results = [];
  for (const club of clubs) {
    if (!club) continue;
    const snap = await getDocs(
      query(collection(db, "pdfSubmissions"), where("status", "==", "menunggu"), where("createdByClub", "==", club))
    );
    results.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }
  const seen = new Set();
  return results
    .filter(d => { if (seen.has(d.id)) return false; seen.add(d.id); return true; })
    .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
}

// Pegawai — every PDF submitted within their division/category, regardless of
// who it's addressed to
export async function getPdfSubmissionsByCategory(category) {
  if (!category) return [];
  const snap = await getDocs(query(
    collection(db, "pdfSubmissions"),
    where("status", "==", "menunggu"),
    where("createdByCategory", "==", category)
  ));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
}

export async function getPdfSubmissionsByUser(uid) {
  const snap = await getDocs(query(collection(db, "pdfSubmissions"), where("createdBy", "==", uid)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
}

export async function updatePdfSubmissionStatus(id, status, reviewer, additionalData = {}) {
  await updateDoc(doc(db, "pdfSubmissions", id), {
    status,
    reviewedBy:      reviewer.uid,
    reviewedByEmail: reviewer.email,
    reviewedAt:      serverTimestamp(),
    ...additionalData,
  });
}

// Admin-only — permanently removes a PDF submission and its Storage file (see
// firestore.rules / storage.rules). The Storage delete is best-effort: if the
// file is already gone we still want the Firestore doc removed.
export async function deletePdfSubmission(id, pdfPath) {
  if (pdfPath) {
    try { await deleteObject(ref(storage, pdfPath)); } catch { /* file may already be gone */ }
  }
  await deleteDoc(doc(db, "pdfSubmissions", id));
}
