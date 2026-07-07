import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase/config";
import { getAllBorang } from "./formService";
import { getAllPdfSubmissions } from "./pdfSubmissionService";

const transactionsRef = collection(db, "transactions");
const usersRef = collection(db, "users");
const programmesRef = collection(db, "programmes");

const PENDING_STATUSES  = ["menunggu", "disemak"];
const APPROVED_STATUSES = ["diluluskan", "selesai"];

export async function getTreasurerDashboardSummary(uid, programmeCode) {
  const constraints = [where("createdBy", "==", uid)];
  if (programmeCode) constraints.push(where("programmeCode", "==", programmeCode));
  const q = query(transactionsRef, ...constraints);
  const snapshot = await getDocs(q);

  const records = snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }));

  const totalIncome  = records.filter((i) => i.type === "income").reduce((s, i) => s + Number(i.amount || 0), 0);
  const totalExpense = records.filter((i) => i.type === "expense").reduce((s, i) => s + Number(i.amount || 0), 0);

  return { totalIncome, totalExpense, balance: totalIncome - totalExpense };
}

export async function getAdminDashboardSummary() {
  const [usersSnap, txSnap, forms, pdfs] = await Promise.all([
    getDocs(usersRef),
    getDocs(transactionsRef),
    getAllBorang(),
    getAllPdfSubmissions(),
  ]);

  const users        = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const transactions  = txSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const submissions   = [
    ...forms.map(f => ({ ...f, kind: "borang" })),
    ...pdfs.map(p  => ({ ...p, kind: "pdf" })),
  ].sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));

  return {
    totalUsers:        users.length,
    totalTransactions:  transactions.length,
    pendingCount:  submissions.filter(s => PENDING_STATUSES.includes(s.status)).length,
    approvedCount: submissions.filter(s => APPROVED_STATUSES.includes(s.status)).length,
    rejectedCount: submissions.filter(s => s.status === "ditolak").length,
    users,
    transactions,
    submissions,
  };
}

// Summary for Bendahari Kelab — all programmes in their club
export async function getBendahariKelabSummary(club) {
  if (!club) return { programmes: [], totalIncome: 0, totalExpense: 0, balance: 0 };

  const progSnap = await getDocs(query(programmesRef, where("club", "==", club)));
  const programmes = progSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  if (programmes.length === 0) {
    return { programmes: [], totalIncome: 0, totalExpense: 0, balance: 0 };
  }

  const codes = programmes.map((p) => p.code);

  // Firestore "in" supports up to 30 values — chunk if needed
  const allTxns = [];
  for (let i = 0; i < codes.length; i += 30) {
    const chunk = codes.slice(i, i + 30);
    const snap = await getDocs(query(transactionsRef, where("programmeCode", "in", chunk)));
    allTxns.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }

  const progSummaries = programmes.map((prog) => {
    const txns    = allTxns.filter((t) => t.programmeCode === prog.code);
    const income  = txns.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount || 0), 0);
    const expense = txns.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount || 0), 0);
    return {
      ...prog,
      totalIncome:  income,
      totalExpense: expense,
      balance:      income - expense,
    };
  });

  const totalIncome  = progSummaries.reduce((s, p) => s + p.totalIncome, 0);
  const totalExpense = progSummaries.reduce((s, p) => s + p.totalExpense, 0);

  return {
    programmes:   progSummaries,
    totalIncome,
    totalExpense,
    balance:      totalIncome - totalExpense,
  };
}
