import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "../firebase/config";

// Uploads a receipt image to Storage under receipts/{uid}/, timestamp-prefixed
// and sanitized to avoid path/collision issues, and returns both the public
// download URL (for display) and the storage path (needed later to delete it).
export async function uploadReceipt(file, uid) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileName = `${Date.now()}-${safeName}`;
  const storageRef = ref(storage, `receipts/${uid}/${fileName}`);

  await uploadBytes(storageRef, file);
  const downloadURL = await getDownloadURL(storageRef);

  return {
    receiptUrl: downloadURL,
    receiptPath: storageRef.fullPath,
  };
}

// Companion to uploadReceipt() — removes the file from Storage using the
// path saved on the transaction, called when a transaction is deleted.
export async function deleteReceiptByPath(path) {
  if (!path) return;
  const fileRef = ref(storage, path);
  await deleteObject(fileRef);
}