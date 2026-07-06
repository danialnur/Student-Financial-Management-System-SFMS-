import { storage, db } from "../firebase/config";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { addDoc, collection, getDocs, query, where, updateDoc, doc, serverTimestamp } from "firebase/firestore";

// Upload PDF blob to Firebase Storage and record submission in Firestore
export async function submitPdfBorang(uid, email, club, formType, formName, pdfBlob, extraData = {}) {
  const path = `pdf_submissions/${formType}/${uid}/${Date.now()}.pdf`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, pdfBlob, { contentType: "application/pdf" });
  const pdfUrl = await getDownloadURL(storageRef);

  await addDoc(collection(db, "pdfSubmissions"), {
    formType,
    formName,
    createdBy:      uid,
    createdByEmail: email,
    createdByClub:  club || "",
    pdfUrl,
    pdfPath:        path,
    status:         "menunggu",
    createdAt:      serverTimestamp(),
    ...extraData,
  });

  return pdfUrl;
}

export async function getPdfSubmissions() {
  const snap = await getDocs(query(collection(db, "pdfSubmissions"), where("status", "==", "menunggu")));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
}

export async function getPdfSubmissionsByClub(club) {
  if (!club) return [];
  const snap = await getDocs(
    query(collection(db, "pdfSubmissions"), where("status", "==", "menunggu"), where("createdByClub", "==", club))
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
}

export async function getPdfSubmissionsByUser(uid) {
  const snap = await getDocs(query(collection(db, "pdfSubmissions"), where("createdBy", "==", uid)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
}

export async function updatePdfSubmissionStatus(id, status, reviewer) {
  await updateDoc(doc(db, "pdfSubmissions", id), {
    status,
    reviewedBy:      reviewer.uid,
    reviewedByEmail: reviewer.email,
    reviewedAt:      serverTimestamp(),
  });
}
