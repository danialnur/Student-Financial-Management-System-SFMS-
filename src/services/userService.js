import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { encryptField } from "../utils/fieldEncryption";

const usersRef = collection(db, "users");

export async function getAllUsers() {
  const snapshot = await getDocs(usersRef);
  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
}

// Public, PII-free lookup used only to resolve a username to an email before
// the user is authenticated (login-by-username). Backed by its own collection
// (not the users collection) so Firestore rules can keep `users` fully locked
// down while still allowing this one pre-auth read.
export async function getEmailByUsername(username) {
  const snap = await getDoc(doc(db, "usernames", username.toLowerCase().trim()));
  if (!snap.exists()) return null;
  return snap.data().email;
}

export async function isEmailTaken(email) {
  const normalized = (email || "").trim().toLowerCase();
  if (!normalized) return false;
  const snapshot = await getDocs(usersRef);
  return snapshot.docs.some((d) => (d.data().email ?? "").trim().toLowerCase() === normalized);
}

// accountStatus: "active" for admin-created accounts (default) and
// self-registered treasurers; "pending_advisor" / "pending_admin" for
// self-registered bendahari_kelab / advisor / pegawai awaiting approval.
export async function createUserProfile(uid, data) {
  const username = (data.email || "").split("@")[0].toLowerCase();
  const [encMatricNumber, encStaffNumber, encIcNumber, encPhone] = await Promise.all([
    encryptField(data.matricNumber ?? ""),
    encryptField(data.staffNumber  ?? ""),
    encryptField(data.icNumber     ?? ""),
    encryptField(data.phone        ?? ""),
  ]);
  await setDoc(doc(db, "users", uid), {
    email:        data.email,
    username:     username,
    role:         data.role,
    fullName:     data.fullName     ?? "",
    matricNumber: encMatricNumber,
    staffNumber:  encStaffNumber,
    icNumber:     encIcNumber,
    phone:        encPhone,
    club:         data.role === "bendahari_kelab" ? (data.club ?? "") : "",
    clubs:        data.role === "advisor" ? (data.clubs ?? []).filter(Boolean) : [],
    category:     data.role === "pegawai" ? (data.category ?? "") : "",
    accountStatus: data.accountStatus ?? "active",
    createdAt:    serverTimestamp(),
  });
  await setDoc(doc(db, "usernames", username), { email: data.email, uid });
}

// Advisor — pending bendahari_kelab self-registrations for their own club(s)
export async function getPendingBendahariKelabForClubs(clubs) {
  if (!clubs?.length) return [];
  const results = [];
  for (const club of clubs) {
    if (!club) continue;
    const snap = await getDocs(query(usersRef,
      where("role", "==", "bendahari_kelab"),
      where("accountStatus", "==", "pending_advisor"),
      where("club", "==", club)
    ));
    results.push(...snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }
  return results.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
}

// Admin — pending advisor/pegawai self-registrations
export async function getPendingAdminApprovals() {
  const snap = await getDocs(query(usersRef, where("accountStatus", "==", "pending_admin")));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
}

export async function approveAccount(uid, reviewer) {
  await updateDoc(doc(db, "users", uid), {
    accountStatus:   "active",
    reviewedBy:      reviewer.uid,
    reviewedByEmail: reviewer.email,
    reviewedAt:      serverTimestamp(),
    updatedAt:       serverTimestamp(),
  });
}

export async function rejectAccount(uid, reviewer) {
  await updateDoc(doc(db, "users", uid), {
    accountStatus:   "rejected",
    reviewedBy:      reviewer.uid,
    reviewedByEmail: reviewer.email,
    reviewedAt:      serverTimestamp(),
    updatedAt:       serverTimestamp(),
  });
}

// role-specific:
//   bendahari_kelab → club (string)
//   advisor         → clubs (string[], admin sets 1+)
//   pegawai         → category (string)
export async function updateUserRole(uid, role, extraData = {}) {
  // Admin changing a user's role is itself an approval action.
  const update = { role, accountStatus: "active", updatedAt: serverTimestamp() };
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
  const [encMatricNumber, encIcNumber, encPhone] = await Promise.all([
    encryptField((matricNumber ?? "").trim().toUpperCase()),
    encryptField((icNumber     ?? "").trim()),
    encryptField((phone        ?? "").trim()),
  ]);
  await updateDoc(doc(db, "users", uid), {
    fullName:     (fullName ?? "").trim().toUpperCase(),
    matricNumber: encMatricNumber,
    icNumber:     encIcNumber,
    phone:        encPhone,
    updatedAt:    serverTimestamp(),
  });
}

export async function removeUserAccess(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  const username = snap.exists() ? snap.data().username : null;
  await deleteDoc(doc(db, "users", uid));
  if (username) await deleteDoc(doc(db, "usernames", username));
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
