import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase/config";

const transactionsRef = collection(db, "transactions");

// Scoped server-side so each role only ever requests the slice of transactions
// its Firestore rules actually allow it to read — a full unfiltered collection
// scan (as this used to be) fails outright under role/ownership-scoped rules,
// since Firestore rejects a whole query if any matched document doesn't pass.
export async function getApprovedTransactionsForReport({
  role,
  uid,
  club,
  clubs,
  startDate,
  endDate,
  programmeCode,
}) {
  let q;
  if (role === "treasurer") {
    q = query(transactionsRef, where("createdBy", "==", uid));
  } else if (role === "advisor" && clubs?.length) {
    q = query(transactionsRef, where("createdByClub", "in", clubs.slice(0, 30)));
  } else if ((role === "bendahari_kelab" || role === "pegawai") && club) {
    q = query(transactionsRef, where("createdByClub", "==", club));
  } else if (role === "admin") {
    q = query(transactionsRef);
  } else {
    return [];
  }

  const snapshot = await getDocs(q);

  let records = snapshot.docs.map((docItem) => ({
    id: docItem.id,
    ...docItem.data(),
  }));

  if (programmeCode) {
    records = records.filter((item) => item.programmeCode === programmeCode);
  }

  if (startDate) {
    records = records.filter((item) => item.date >= startDate);
  }

  if (endDate) {
    records = records.filter((item) => item.date <= endDate);
  }

  records.sort((a, b) => (a.date < b.date ? 1 : -1));

  return records;
}
