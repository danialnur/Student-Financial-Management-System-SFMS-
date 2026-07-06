import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, allowedRoles }) {
  const { currentUser, userRole, loading } = useAuth();

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

  return children;
}
