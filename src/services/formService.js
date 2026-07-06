import { db } from "../firebase/config";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { CLUB_CATEGORIES } from "../config/clubsConfig";

// Forms in this list are routed only to the pegawai in charge of the
// submitting club's category, not to advisor/bendahari_kelab reviewers.
export const PEGAWAI_ONLY_FORM_TYPES = ["permohonan-pengecualian-cukai"];

const categoryForClub = (club) => {
  if (!club) return "";
  const entry = Object.entries(CLUB_CATEGORIES).find(([, clubs]) => clubs.includes(club));
  return entry?.[0] ?? "";
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

// For Bendahari Kelab — only forms from their one club (pegawai-only form types excluded)
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
    .filter((d) => !PEGAWAI_ONLY_FORM_TYPES.includes(d.formType))
    .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
};

// For Advisor — forms from one or more assigned clubs (pegawai-only form types excluded)
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
    .filter((d) => !PEGAWAI_ONLY_FORM_TYPES.includes(d.formType))
    .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
};

// For Pegawai — pegawai-only form types (e.g. tax exemption), scoped to their category
export const getPendingCukaiFormsByCategory = async (category) => {
  if (!category) return [];
  const q = query(
    collection(db, "formSubmissions"),
    where("status", "in", ["menunggu", "disemak"]),
    where("formType", "in", PEGAWAI_ONLY_FORM_TYPES),
    where("createdByCategory", "==", category)
  );
  const snap = await getDocs(q);
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

export const updateBorangStatus = async (id, status, reviewer, additionalData = {}) => {
  await updateDoc(doc(db, "formSubmissions", id), {
    status,
    reviewedBy: reviewer.uid,
    reviewedByEmail: reviewer.email,
    reviewedAt: serverTimestamp(),
    ...additionalData,
  });
};
