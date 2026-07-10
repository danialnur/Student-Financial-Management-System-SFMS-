import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase/config";

const programmesRef = collection(db, "programmes");

export async function getAllProgrammes() {
  const q = query(programmesRef, orderBy("code", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Kod program must never contain spaces or dashes.
const normalizeCode = (code) => code.trim().toUpperCase().replace(/[\s-]+/g, "");

export async function isProgrammeCodeTaken(code) {
  const q = query(programmesRef, where("code", "==", normalizeCode(code)));
  const snapshot = await getDocs(q);
  return !snapshot.empty;
}

export async function isProgrammeNameTaken(name) {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return false;
  const snapshot = await getDocs(programmesRef);
  return snapshot.docs.some((d) => (d.data().name ?? "").trim().toLowerCase() === normalized);
}

export async function getProgrammesByClub(club) {
  const q = query(programmesRef, where("club", "==", club));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((d) => !d.status || d.status === "approved")
    .sort((a, b) => a.code.localeCompare(b.code));
}

export async function getPendingProgrammesByClub(club) {
  const q = query(programmesRef, where("club", "==", club), where("status", "==", "pending"));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
}

export async function approveProgramme(id) {
  await updateDoc(doc(db, "programmes", id), {
    status:     "approved",
    approvedAt: serverTimestamp(),
  });
}

export async function rejectProgramme(id) {
  await updateDoc(doc(db, "programmes", id), {
    status:     "rejected",
    rejectedAt: serverTimestamp(),
  });
}

export async function getProgrammeById(id) {
  const snap = await getDoc(doc(db, "programmes", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function getProgrammesByTreasurer(uid) {
  const q = query(programmesRef, where("treasurerUid", "==", uid));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

export async function createProgramme(data) {
  await addDoc(programmesRef, {
    code:              normalizeCode(data.code),
    name:              data.name.trim(),
    club:              data.club         ?? "",
    treasurerUid:      data.treasurerUid ?? "",
    status:            data.status       ?? "pending",
    requestedByEmail:  data.requestedByEmail ?? "",
    createdAt:         serverTimestamp(),
  });
}

export async function updateProgramme(id, data) {
  await updateDoc(doc(db, "programmes", id), {
    code:      normalizeCode(data.code),
    name:      data.name.trim(),
    club:      data.club ?? "",
    updatedAt: serverTimestamp(),
  });
}

export async function deleteProgramme(id) {
  await deleteDoc(doc(db, "programmes", id));
}
