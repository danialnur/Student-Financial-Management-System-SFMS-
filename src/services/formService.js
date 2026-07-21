import { db } from "../firebase/config";
import {
  collection,
  addDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { CLUB_CATEGORIES } from "../config/clubsConfig";

// Forms in this list are always ACTIONED by the pegawai in charge of the
// submitting club's category (regardless of any submitTo choice). Everyone in
// scope (bendahari_kelab/advisor/pegawai of that club/category) can still see
// them — see getIntendedReviewerRole.
export const PEGAWAI_ONLY_FORM_TYPES = ["permohonan-pengecualian-cukai"];

const categoryForClub = (club) => {
  if (!club) return "";
  const entry = Object.entries(CLUB_CATEGORIES).find(([, clubs]) => clubs.includes(club));
  return entry?.[0] ?? "";
};

// Which role is actually meant to act (fill any reviewer section + approve/
// reject) on a given submission. Bendahari_kelab/advisor/pegawai in scope can
// all VIEW every submission in their club/category — this only gates ACTION.
export const getIntendedReviewerRole = (item) => {
  if (PEGAWAI_ONLY_FORM_TYPES.includes(item.formType)) return "pegawai";
  if (item.submitTo) return item.submitTo;
  return "advisor";
};

export const submitBorang = async (data) => {
  return addDoc(collection(db, "formSubmissions"), {
    ...data,
    createdByCategory: categoryForClub(data.createdByClub),
    status: "menunggu",
    createdAt: serverTimestamp(),
  });
};

export const getBorangByUser = async (uid) => {
  const q = query(
    collection(db, "formSubmissions"),
    where("createdBy", "==", uid)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
};

export const getPendingBorang = async () => {
  const q = query(
    collection(db, "formSubmissions"),
    where("status", "in", ["menunggu", "disemak"])
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
};

// For Bendahari Kelab — every form submitted within their one club, regardless
// of who it's addressed to (they can see it and to whom, even if they can't act on it)
export const getPendingBorangByClub = async (club) => {
  if (!club) return [];
  const q = query(
    collection(db, "formSubmissions"),
    where("status", "in", ["menunggu", "disemak"]),
    where("createdByClub", "==", club)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
};

// For Advisor — every form submitted within one or more assigned clubs,
// regardless of who it's addressed to
export const getPendingBorangByClubs = async (clubs) => {
  if (!clubs || clubs.length === 0) return [];
  const results = [];
  for (const club of clubs) {
    if (!club) continue;
    const q = query(
      collection(db, "formSubmissions"),
      where("status", "in", ["menunggu", "disemak"]),
      where("createdByClub", "==", club)
    );
    const snap = await getDocs(q);
    results.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }
  const seen = new Set();
  return results
    .filter(d => { if (seen.has(d.id)) return false; seen.add(d.id); return true; })
    .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
};

// For Pegawai — every form submitted within their division/category,
// regardless of who it's addressed to
export const getPendingBorangByCategory = async (category) => {
  if (!category) return [];
  const q = query(
    collection(db, "formSubmissions"),
    where("status", "in", ["menunggu", "disemak"]),
    where("createdByCategory", "==", category)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
};

// Admin — every form submission in the system, all statuses, unrestricted
export const getAllBorang = async () => {
  const snap = await getDocs(collection(db, "formSubmissions"));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
};

// Bendahari Kelab — all forms from their club, all statuses
export const getAllBorangByClub = async (club) => {
  if (!club) return [];
  const q = query(
    collection(db, "formSubmissions"),
    where("createdByClub", "==", club)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
};

// Owner-only edit of a submission's own content while it's still pending review
// (see firestore.rules — status/createdBy are locked, only the content fields
// below are writable). Distinct from updateBorangStatus, which is the reviewer's
// approve/reject/selesai action and never touches these content fields.
export const updateBorangFields = async (id, data) => {
  await updateDoc(doc(db, "formSubmissions", id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

export const updateBorangStatus = async (id, status, reviewer, additionalData = {}) => {
  await updateDoc(doc(db, "formSubmissions", id), {
    status,
    reviewedBy: reviewer.uid,
    reviewedByEmail: reviewer.email,
    reviewedAt: serverTimestamp(),
    ...additionalData,
  });
};

// Admin-only — permanently removes a form submission (see firestore.rules).
export const deleteBorang = async (id) => {
  await deleteDoc(doc(db, "formSubmissions", id));
};
