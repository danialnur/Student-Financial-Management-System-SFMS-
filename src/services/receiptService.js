import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "../firebase/config";

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

export async function deleteReceiptByPath(path) {
  if (!path) return;
  const fileRef = ref(storage, path);
  await deleteObject(fileRef);
}