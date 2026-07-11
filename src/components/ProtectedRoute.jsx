import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// requireActive: set to false only for the pending-approval holding page
// itself, so a not-yet-approved user can actually reach it instead of being
// redirected back to it forever.
export default function ProtectedRoute({ children, allowedRoles, requireActive = true }) {
  const { currentUser, userRole, userProfile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <img
            src="https://studentaffairs.utm.my/bapp/wp-content/uploads/sites/11/2024/09/Projek-Logo-BAPP-02.png"
            alt="BAPP UTM"
            className="mx-auto h-32 w-auto object-contain opacity-80"
          />
          <p className="mt-3 text-sm text-gray-400">Memuatkan...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(userRole)) {
    return <Navigate to="/login" replace />;
  }

  // Self-registered bendahari_kelab/advisor/pegawai accounts can't act until
  // approved (see firestore.rules) — bounce them to the holding page.
  if (requireActive && userProfile?.accountStatus && userProfile.accountStatus !== "active") {
    return <Navigate to="/menunggu-kelulusan" replace />;
  }

  return children;
}
