import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase/config";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser]   = useState(null);
  const [userRole, setUserRole]         = useState(null);
  const [userProfile, setUserProfile]   = useState(null);
  const [loading, setLoading]           = useState(true);

  const fetchProfile = useCallback(async (user) => {
    if (!user) { setUserRole(null); setUserProfile(null); return; }
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const data = snap.data();
        setUserRole(data.role || null);
        setUserProfile(data);
      } else {
        setUserRole(null); setUserProfile(null);
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
      setUserRole(null); setUserProfile(null);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      setCurrentUser(user);
      await fetchProfile(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [fetchProfile]);

  // Call this after saving signatures or updating profile to refresh context
  const refreshProfile = useCallback(async () => {
    if (currentUser) await fetchProfile(currentUser);
  }, [currentUser, fetchProfile]);

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ currentUser, userRole, userProfile, loading, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
