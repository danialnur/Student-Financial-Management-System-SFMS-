import {
  collection, getDocs, getDoc, setDoc, updateDoc, deleteDoc, doc,
  serverTimestamp, query, where,
} from "firebase/firestore";
import { db } from "../firebase/config";

export const MAX_ATTEMPTS         = 1; // one request attempt per programme
export const MAX_PENDING_REQUESTS = 1; // one pending request at a time across all programmes

const accessRef   = collection(db, "programmeAccess");
const accessDocId = (treasurerUid, programmeId) => `${treasurerUid}_${programmeId}`;

async function countPending(treasurerUid) {
  const snap = await getDocs(query(accessRef, where("treasurerUid", "==", treasurerUid)));
  return snap.docs.filter(d => d.data().status === "pending").length;
}

export async function requestProgrammeAccess({ programmeId, programmeCode, programmeName, club, treasurerUid, treasurerEmail, treasurerUsername }) {
  const docRef = doc(db, "programmeAccess", accessDocId(treasurerUid, programmeId));
  const snap   = await getDoc(docRef);

  if (!snap.exists()) {
    if ((await countPending(treasurerUid)) >= MAX_PENDING_REQUESTS) throw new Error("MAX_PENDING_EXCEEDED");
    await setDoc(docRef, {
      programmeId, programmeCode, programmeName, club,
      treasurerUid, treasurerEmail,
      treasurerUsername: treasurerUsername || "",
      status:       "pending",
      attemptCount: 1,
      requestedAt:  serverTimestamp(),
    });
  } else {
    const data = snap.data();
    if (data.status === "rejected") {
      // MAX_ATTEMPTS = 1 means rejection is always permanent for self-service
      throw new Error("MAX_ATTEMPTS_EXCEEDED");
    } else if (data.status === "revoked") {
      if ((await countPending(treasurerUid)) >= MAX_PENDING_REQUESTS) throw new Error("MAX_PENDING_EXCEEDED");
      await updateDoc(docRef, {
        status:      "pending",
        requestedAt: serverTimestamp(),
        revokedAt:   null,
      });
    }
    // pending or approved → do nothing
  }
}

// BK grants access directly without treasurer going through request flow
export async function grantDirectAccess({ programmeId, programmeCode, programmeName, club, treasurerUid, treasurerEmail, treasurerUsername }) {
  const docRef = doc(db, "programmeAccess", accessDocId(treasurerUid, programmeId));
  await setDoc(docRef, {
    programmeId, programmeCode, programmeName, club,
    treasurerUid, treasurerEmail,
    treasurerUsername: treasurerUsername || "",
    status:          "approved",
    attemptCount:    1,
    requestedAt:     serverTimestamp(),
    approvedAt:      serverTimestamp(),
    grantedDirectly: true,
  });
}

// BK cancels a rejection — deletes the record so the treasurer can request once more
export async function revokeRejection(id) {
  await deleteDoc(doc(db, "programmeAccess", id));
}

export async function getAccessByTreasurer(treasurerUid) {
  const q    = query(accessRef, where("treasurerUid", "==", treasurerUid));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getAccessRequestsByClub(club) {
  const q    = query(accessRef, where("club", "==", club));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.requestedAt?.seconds ?? 0) - (a.requestedAt?.seconds ?? 0));
}

export async function approveAccess(id) {
  await updateDoc(doc(db, "programmeAccess", id), { status: "approved", approvedAt: serverTimestamp() });
}

export async function rejectAccess(id) {
  await updateDoc(doc(db, "programmeAccess", id), { status: "rejected", rejectedAt: serverTimestamp() });
}

export async function revokeAccess(id) {
  await updateDoc(doc(db, "programmeAccess", id), { status: "revoked", revokedAt: serverTimestamp() });
}
