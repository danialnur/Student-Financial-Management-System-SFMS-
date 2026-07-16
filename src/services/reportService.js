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
  programmeCodes,
}) {
  let docs;
  if (role === "treasurer") {
    const snapshot = await getDocs(query(transactionsRef, where("createdBy", "==", uid)));
    docs = snapshot.docs;
  } else if (role === "advisor" && clubs?.length) {
    // Firestore's "in" operator accepts at most 30 values per clause, so an
    // Advisor assigned to more than 30 clubs is queried in chunks of 30 and
    // the results merged, rather than silently truncating to the first 30.
    docs = [];
    for (let i = 0; i < clubs.length; i += 30) {
      const chunk = clubs.slice(i, i + 30);
      const snapshot = await getDocs(query(transactionsRef, where("createdByClub", "in", chunk)));
      docs.push(...snapshot.docs);
    }
  } else if ((role === "bendahari_kelab" || role === "pegawai") && club) {
    const snapshot = await getDocs(query(transactionsRef, where("createdByClub", "==", club)));
    docs = snapshot.docs;
  } else if (role === "admin") {
    const snapshot = await getDocs(query(transactionsRef));
    docs = snapshot.docs;
  } else {
    return [];
  }

  let records = docs.map((docItem) => ({
    id: docItem.id,
    ...docItem.data(),
  }));

  if (programmeCode) {
    records = records.filter((item) => item.programmeCode === programmeCode);
  } else if (programmeCodes?.length) {
    records = records.filter((item) => programmeCodes.includes(item.programmeCode));
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
