import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyD5EcjjNc70L5euO51E1111dLMMtzgDp8o",
  authDomain: "financial-management-sys-1cbcb.firebaseapp.com",
  projectId: "financial-management-sys-1cbcb",
  storageBucket: "financial-management-sys-1cbcb.firebasestorage.app",
  messagingSenderId: "579385487301",
  appId: "1:579385487301:web:c4af2a10fc629cc4a225ac",
};

// A second Firebase App instance with its own Auth session, used only for
// Admin's "Create User" flow. createUserWithEmailAndPassword() on the
// *default* auth instance would sign the admin out and sign in as the newly
// created account instead — this keeps the admin's own session untouched.
const secondaryApp =
  getApps().find((app) => app.name === "Secondary") ||
  initializeApp(firebaseConfig, "Secondary");

export const secondaryAuth = getAuth(secondaryApp);