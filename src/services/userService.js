import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase/config";

const usersRef = collection(db, "users");

export async function getAllUsers() {
  const q = query(usersRef, orderBy("email", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function getEmailByUsername(username) {
  const q = query(usersRef, where("username", "==", username.toLowerCase().trim()));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data().email;
}

export async function createUserProfile(uid, data) {
  const username = (data.email || "").split("@")[0].toLowerCase();
  await setDoc(doc(db, "users", uid), {
    email:        data.email,
    username:     username,
    role:         data.role,
    fullName:     data.fullName     ?? "",
    matricNumber: data.matricNumber ?? "",
    icNumber:     data.icNumber     ?? "",
    phone:        data.phone        ?? "",
    club:         data.role === "bendahari_kelab" ? (data.club ?? "") : "",
    clubs:        data.role === "advisor" ? (data.clubs ?? []).filter(Boolean) : [],
    category:     data.role === "pegawai" ? (data.category ?? "") : "",
    createdAt:    serverTimestamp(),
  });
}

// role-specific:
//   bendahari_kelab → club (string)
//   advisor         → clubs (string[], admin sets 1+)
//   pegawai         → category (string)
export async function updateUserRole(uid, role, extraData = {}) {
  const update = { role, updatedAt: serverTimestamp() };
  if (role === "bendahari_kelab") {
    update.club     = extraData.club ?? "";
    update.clubs    = [];
    update.category = "";
  } else if (role === "advisor") {
    update.clubs    = (extraData.clubs ?? []).filter(Boolean);
    update.club     = "";
    update.category = "";
  } else if (role === "pegawai") {
    update.category = extraData.category ?? "";
    update.club     = "";
    update.clubs    = [];
  } else {
    update.club     = "";
    update.clubs    = [];
    update.category = "";
  }
  await updateDoc(doc(db, "users", uid), update);
}

// Admin-only: add or remove a club from an advisor's clubs array
export async function updateAdvisorClubs(uid, clubs) {
  await updateDoc(doc(db, "users", uid), {
    clubs:     clubs.filter(Boolean),
    updatedAt: serverTimestamp(),
  });
}

// Self-service: user edits their own personal details (the same fields collected at registration)
export async function updateUserProfile(uid, { fullName, matricNumber, icNumber, phone }) {
  await updateDoc(doc(db, "users", uid), {
    fullName:     (fullName ?? "").trim().toUpperCase(),
    matricNumber: (matricNumber ?? "").trim().toUpperCase(),
    icNumber:     (icNumber ?? "").trim(),
    phone:        (phone ?? "").trim(),
    updatedAt:    serverTimestamp(),
  });
}

export async function removeUserAccess(uid) {
  await deleteDoc(doc(db, "users", uid));
}

export async function searchTreasurerByUsernameOrEmail(term) {
  if (!term.trim()) return [];
  const t = term.trim().toLowerCase();
  const [byUsername, byEmail] = await Promise.all([
    getDocs(query(usersRef, where("username", "==", t))),
    getDocs(query(usersRef, where("email",    "==", t))),
  ]);
  const seen = new Set();
  const results = [];
  for (const snap of [byUsername, byEmail]) {
    for (const d of snap.docs) {
      if (!seen.has(d.id)) {
        seen.add(d.id);
        const data = { id: d.id, ...d.data() };
        if (data.role === "treasurer") results.push(data);
      }
    }
  }
  return results;
}
