import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase/config";
import { decryptField } from "../utils/fieldEncryption";

const AuthContext = createContext();

const SELECTED_CLUB_KEY = "pegawai_selected_club";

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser]   = useState(null);
  const [userRole, setUserRole]         = useState(null);
  const [userProfile, setUserProfile]   = useState(null);
  const [loading, setLoading]           = useState(true);
  const [selectedClub, setSelectedClubState] = useState(() => {
    const stored = sessionStorage.getItem(SELECTED_CLUB_KEY);
    if (!stored) return "";
    try {
      return JSON.parse(stored).club || "";
    } catch {
      return "";
    }
  });

  const fetchProfile = useCallback(async (user) => {
    if (!user) { setUserRole(null); setUserProfile(null); return; }
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const data = snap.data();
        // icNumber/phone/matricNumber are stored encrypted (see fieldEncryption.js) —
        // decrypt once here so every consumer of userProfile sees plain values.
        const [icNumber, phone, matricNumber] = await Promise.all([
          decryptField(data.icNumber),
          decryptField(data.phone),
          decryptField(data.matricNumber),
        ]);
        setUserRole(data.role || null);
        setUserProfile({ ...data, icNumber, phone, matricNumber });
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

      // A stored club selection only stays valid for the same signed-in user.
      const stored = sessionStorage.getItem(SELECTED_CLUB_KEY);
      let storedUid = null;
      let storedClub = "";
      if (stored) {
        try {
          ({ uid: storedUid, club: storedClub } = JSON.parse(stored));
        } catch {
          // ignore malformed value
        }
      }
      if (!user || storedUid !== user.uid) {
        sessionStorage.removeItem(SELECTED_CLUB_KEY);
        setSelectedClubState("");
      } else {
        setSelectedClubState(storedClub || "");
      }

      setLoading(false);
    });
    return () => unsubscribe();
  }, [fetchProfile]);

  // Call this after saving signatures or updating profile to refresh context
  const refreshProfile = useCallback(async () => {
    if (currentUser) await fetchProfile(currentUser);
  }, [currentUser, fetchProfile]);

  const setSelectedClub = useCallback((club) => {
    if (!currentUser) return;
    sessionStorage.setItem(SELECTED_CLUB_KEY, JSON.stringify({ uid: currentUser.uid, club }));
    setSelectedClubState(club);
  }, [currentUser]);

  const logout = () => {
    sessionStorage.removeItem(SELECTED_CLUB_KEY);
    setSelectedClubState("");
    return signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ currentUser, userRole, userProfile, loading, logout, refreshProfile, selectedClub, setSelectedClub }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
