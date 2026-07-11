import { Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import MenungguKelulusanPage from "./pages/MenungguKelulusanPage";
import ProgrammeManagementPage from "./pages/ProgrammeManagementPage";
import TreasurerDashboard from "./pages/TreasurerDashboard";
import AdvisorDashboard from "./pages/AdvisorDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import BendahariKelabDashboard from "./pages/BendahariKelabDashboard";
import PegawaiDashboard from "./pages/PegawaiDashboard";
import PegawaiSelectClubPage from "./pages/PegawaiSelectClubPage";
import AddTransactionPage from "./pages/AddTransactionPage";
import EditTransactionPage from "./pages/EditTransactionPage";
import TransactionHistoryPage from "./pages/TransactionHistoryPage";
import ApprovalPage from "./pages/ApprovalPage";
import UserManagementPage from "./pages/UserManagementPage";
import ReportPage from "./pages/ReportPage";
import BendahariBorangPage from "./pages/BendahariBorangPage";
import PegawaiReportPage from "./pages/PegawaiReportPage";
import ProgrammeRequestsPage from "./pages/ProgrammeRequestsPage";
import BendahariKelabProgrammesPage from "./pages/BendahariKelabProgrammesPage";
import BendahariKelabAccessPage from "./pages/BendahariKelabAccessPage";
import TreasurerRequestAccessPage from "./pages/TreasurerRequestAccessPage";
import TreasurerProfilePage from "./pages/TreasurerProfilePage";
import ReceiptListPage from "./pages/ReceiptListPage";
import ProtectedRoute from "./components/ProtectedRoute";
import ScrollRestorer from "./components/ScrollRestorer";

export default function App() {
  return (
    <>
    <ScrollRestorer />
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/menunggu-kelulusan"
        element={
          <ProtectedRoute allowedRoles={["bendahari_kelab", "advisor", "pegawai"]} requireActive={false}>
            <MenungguKelulusanPage />
          </ProtectedRoute>
        }
      />

      {/* ── Treasurer ── */}
      <Route path="/treasurer/dashboard" element={<ProtectedRoute allowedRoles={["treasurer"]}><TreasurerDashboard /></ProtectedRoute>} />
      <Route path="/treasurer/request-access" element={<ProtectedRoute allowedRoles={["treasurer"]}><TreasurerRequestAccessPage /></ProtectedRoute>} />
      <Route path="/treasurer/add-transaction" element={<ProtectedRoute allowedRoles={["treasurer"]}><AddTransactionPage /></ProtectedRoute>} />
      <Route path="/treasurer/transactions" element={<ProtectedRoute allowedRoles={["treasurer"]}><TransactionHistoryPage /></ProtectedRoute>} />
      <Route path="/treasurer/edit-transaction/:id" element={<ProtectedRoute allowedRoles={["treasurer"]}><EditTransactionPage /></ProtectedRoute>} />
      <Route path="/treasurer/receipts" element={<ProtectedRoute allowedRoles={["treasurer"]}><ReceiptListPage /></ProtectedRoute>} />
      <Route path="/treasurer/borang-kewangan" element={<ProtectedRoute allowedRoles={["treasurer"]}><ReportPage tab="borang" /></ProtectedRoute>} />
      <Route path="/treasurer/penyata-kewangan" element={<ProtectedRoute allowedRoles={["treasurer"]}><ReportPage tab="laporan" /></ProtectedRoute>} />
      <Route path="/treasurer/profile" element={<ProtectedRoute allowedRoles={["treasurer"]}><TreasurerProfilePage /></ProtectedRoute>} />

      {/* ── Advisor ── */}
      <Route path="/advisor/dashboard" element={<ProtectedRoute allowedRoles={["advisor"]}><AdvisorDashboard /></ProtectedRoute>} />
      <Route path="/advisor/approvals" element={<ProtectedRoute allowedRoles={["advisor", "admin"]}><ApprovalPage /></ProtectedRoute>} />
      <Route path="/advisor/penyata-kewangan" element={<ProtectedRoute allowedRoles={["advisor"]}><ReportPage tab="laporan" /></ProtectedRoute>} />

      {/* ── Admin ── */}
      <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={["admin"]}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute allowedRoles={["admin"]}><UserManagementPage /></ProtectedRoute>} />
      <Route path="/admin/programmes" element={<ProtectedRoute allowedRoles={["admin"]}><ProgrammeManagementPage /></ProtectedRoute>} />

      {/* ── Bendahari Kelab ── */}
      <Route path="/bendahari-kelab/dashboard" element={<ProtectedRoute allowedRoles={["bendahari_kelab"]}><BendahariKelabDashboard /></ProtectedRoute>} />
      <Route path="/bendahari-kelab/approvals" element={<ProtectedRoute allowedRoles={["bendahari_kelab"]}><ApprovalPage /></ProtectedRoute>} />
      <Route path="/bendahari-kelab/forms"               element={<ProtectedRoute allowedRoles={["bendahari_kelab"]}><BendahariBorangPage /></ProtectedRoute>} />
      <Route path="/bendahari-kelab/penyata-kewangan"     element={<ProtectedRoute allowedRoles={["bendahari_kelab"]}><ReportPage tab="laporan" /></ProtectedRoute>} />
      <Route path="/bendahari-kelab/programme-requests"  element={<ProtectedRoute allowedRoles={["bendahari_kelab"]}><ProgrammeRequestsPage /></ProtectedRoute>} />
      <Route path="/bendahari-kelab/programmes"          element={<ProtectedRoute allowedRoles={["bendahari_kelab"]}><BendahariKelabProgrammesPage /></ProtectedRoute>} />
      <Route path="/bendahari-kelab/access-requests"     element={<ProtectedRoute allowedRoles={["bendahari_kelab"]}><BendahariKelabAccessPage /></ProtectedRoute>} />

      {/* ── Pegawai ── */}
      <Route path="/pegawai/pilih-kelab"        element={<ProtectedRoute allowedRoles={["pegawai"]}><PegawaiSelectClubPage /></ProtectedRoute>} />
      <Route path="/pegawai/dashboard"          element={<ProtectedRoute allowedRoles={["pegawai"]}><PegawaiDashboard /></ProtectedRoute>} />
      <Route path="/pegawai/approvals"          element={<ProtectedRoute allowedRoles={["pegawai"]}><ApprovalPage /></ProtectedRoute>} />
      <Route path="/pegawai/penyata-kewangan"   element={<ProtectedRoute allowedRoles={["pegawai"]}><PegawaiReportPage /></ProtectedRoute>} />
    </Routes>
    </>
  );
}
