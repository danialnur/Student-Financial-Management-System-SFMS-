import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyD5EcjjNc70L5euO51E1111dLMMtzgDp8o",
  authDomain: "financial-management-sys-1cbcb.firebaseapp.com",
  projectId: "financial-management-sys-1cbcb",
  storageBucket: "financial-management-sys-1cbcb.firebasestorage.app",
  messagingSenderId: "579385487301",
  appId: "1:579385487301:web:c4af2a10fc629cc4a225ac",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;