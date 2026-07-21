import { db, storage } from "../firebase/config";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, uploadString, getDownloadURL, deleteObject } from "firebase/storage";

export async function getSignatures(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? (snap.data().signatures ?? []) : [];
}

// slot: 1 or 2
// The dataUrl is stored on the Firestore user doc itself (not just uploaded to
// Storage) so reading a saved signature back is a normal profile read instead
// of a separate Storage fetch — for users on a slow/flaky path to Storage
// specifically, that Storage round trip was the actual bottleneck even though
// Firestore reads were fine. `url` is kept too, purely as a fallback for
// signatures saved before this change.
export async function saveSignature(uid, slot, dataUrl) {
  const storageRef = ref(storage, `signatures/${uid}/slot-${slot}.png`);
  await uploadString(storageRef, dataUrl, "data_url");
  const url = await getDownloadURL(storageRef);

  const snap = await getDoc(doc(db, "users", uid));
  const existing = snap.exists() ? (snap.data().signatures ?? []) : [];
  const filtered = existing.filter((s) => s.slot !== slot);
  const updated = [...filtered, { slot, url, dataUrl, savedAt: Date.now() }].sort(
    (a, b) => a.slot - b.slot
  );
  await updateDoc(doc(db, "users", uid), { signatures: updated });
  return updated;
}

export async function deleteSignature(uid, slot) {
  try {
    await deleteObject(ref(storage, `signatures/${uid}/slot-${slot}.png`));
  } catch {}

  const snap = await getDoc(doc(db, "users", uid));
  const existing = snap.exists() ? (snap.data().signatures ?? []) : [];
  const updated = existing.filter((s) => s.slot !== slot);
  await updateDoc(doc(db, "users", uid), { signatures: updated });
  return updated;
}
