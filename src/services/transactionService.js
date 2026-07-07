import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { deleteReceiptByPath } from "./receiptService";

const transactionsRef = collection(db, "transactions");

export async function createTransaction(data) {
  const payload = {
    ...data,
    status: "approved",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  return await addDoc(transactionsRef, payload);
}

export async function getTransactionsByUser(uid, programmeCode) {
  const constraints = [where("createdBy", "==", uid)];
  if (programmeCode) constraints.push(where("programmeCode", "==", programmeCode));
  const q = query(transactionsRef, ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
}

// Admin — every transaction in the system, unrestricted
export async function getAllTransactions() {
  const snapshot = await getDocs(transactionsRef);
  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
}

export async function getPendingTransactions() {
  const q = query(transactionsRef, where("status", "==", "pending"));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
}

// Advisor club-scoped: get pending transactions for programme codes belonging to clubs
export async function getPendingTransactionsByProgrammeCodes(codes) {
  if (!codes || codes.length === 0) return [];
  const results = [];
  for (let i = 0; i < codes.length; i += 30) {
    const chunk = codes.slice(i, i + 30);
    const q = query(transactionsRef, where("status", "==", "pending"), where("programmeCode", "in", chunk));
    const snap = await getDocs(q);
    results.push(...snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }
  return results.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
}

export async function getTransactionById(id) {
  const docRef = doc(db, "transactions", id);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) return null;

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

export async function updateTransactionFields(id, data) {
  const docRef = doc(db, "transactions", id);

  await updateDoc(docRef, {
    ...data,
    amount: Number(data.amount),
    updatedAt: serverTimestamp(),
  });
}

export async function updateTransactionStatus(id, status, reviewedBy) {
  const docRef = doc(db, "transactions", id);

  await updateDoc(docRef, {
    status,
    reviewedByUid: reviewedBy.uid,
    reviewedByEmail: reviewedBy.email,
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function removeTransaction(id) {
  const docRef = doc(db, "transactions", id);
  const snapshot = await getDoc(docRef);

  if (snapshot.exists()) {
    const data = snapshot.data();
    if (data.receipts?.length) {
      await Promise.all(data.receipts.map((r) => deleteReceiptByPath(r.receiptPath)));
    } else if (data.receiptPath) {
      await deleteReceiptByPath(data.receiptPath);
    }
  }

  await deleteDoc(docRef);
}