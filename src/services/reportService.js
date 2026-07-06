import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";

const transactionsRef = collection(db, "transactions");

export async function getApprovedTransactionsForReport({
  role,
  uid,
  club,
  startDate,
  endDate,
  programmeCode,
}) {
  const snapshot = await getDocs(transactionsRef);

  let records = snapshot.docs.map((docItem) => ({
    id: docItem.id,
    ...docItem.data(),
  }));

  if (role === "treasurer") {
    records = records.filter((item) => item.createdBy === uid);
  }

  if (role === "bendahari_kelab" && club) {
    records = records.filter((item) => item.createdByClub === club);
  }

  if (role === "pegawai" && club) {
    records = records.filter((item) => item.createdByClub === club);
  }

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