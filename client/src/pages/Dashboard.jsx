import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import StammdatenModal from '../components/StammdatenModal';
import { useAuth } from '../hooks/useAuth';
import { BrokerProvider } from '../hooks/useBroker';
import { DashboardProvider } from '../hooks/useDashboard';
import DashboardLayout from './dashboard/DashboardLayout';
import {
  BeraterHome,
  BeraterLeadDetail,
  BeraterLeads,
  BeraterPayments,
  BeraterProfile,
  BeraterCompany,
  BeraterSecurity,
  BeraterCalendar,
  BeraterSupport,
} from './dashboard/BeraterViews';
import {
  AdminOverview,
  AdminUsers,
  AdminPayment,
  AdminProfile,
} from './dashboard/AdminViews';
import { AdminLeadEditor, AdminLeads } from './dashboard/AdminLeads';
import { AdminBeraterDetail, AdminBeraterList } from './dashboard/AdminBerater';
import { AdminRequests } from './dashboard/AdminRequests';
import { AdminRequestDetail } from './dashboard/AdminRequestDetail';
import { AdminComplaints } from './dashboard/AdminComplaints';
import { AdminRejectedLeads } from './dashboard/AdminRejectedLeads';

function RedirectAnfordernDetail() {
  const { id } = useParams();
  return <Navigate to={`/dashboard/anfordern/${id}`} replace />;
}

export default function Dashboard() {
  const { isAdmin } = useAuth();

  return (
    <DashboardProvider>
      <BrokerProvider>
        <DashboardLayout>
          <Routes>
            <Route index element={isAdmin ? <AdminOverview /> : <BeraterHome />} />
            {isAdmin ? (
              <>
                <Route path="nutzer" element={<AdminUsers />} />
                <Route path="berater" element={<AdminBeraterList />} />
                <Route path="berater/:id" element={<AdminBeraterDetail />} />
                <Route path="anfordern" element={<AdminRequests />} />
                <Route path="anfordern/:id" element={<AdminRequestDetail />} />
                <Route path="anfragen" element={<Navigate to="/dashboard/anfordern" replace />} />
                <Route path="anfragen/:id" element={<RedirectAnfordernDetail />} />
                <Route path="reklamationen" element={<AdminComplaints />} />
                <Route path="leads" element={<AdminLeads />} />
                <Route path="leads/new" element={<AdminLeadEditor />} />
                <Route path="leads/ungueltig" element={<AdminRejectedLeads />} />
                <Route path="leads/abgelehnt" element={<Navigate to="/dashboard/leads/ungueltig" replace />} />
                <Route path="leads/:id" element={<AdminLeadEditor />} />
                <Route path="zahlung" element={<AdminPayment />} />
                <Route path="profil" element={<AdminProfile />} />
                <Route path="unternehmen" element={<Navigate to="/dashboard/profil" replace />} />
                <Route path="sicherheit" element={<Navigate to="/dashboard/profil" replace />} />
                <Route path="users" element={<Navigate to="/dashboard/nutzer" replace />} />
                <Route path="payment" element={<Navigate to="/dashboard/zahlung" replace />} />
              </>
            ) : (
              <>
                <Route path="leads" element={<BeraterLeads />} />
                <Route path="leads/:leadId" element={<BeraterLeadDetail />} />
                <Route path="kalender" element={<BeraterCalendar />} />
                <Route path="paket" element={<BeraterPayments />} />
                <Route path="zahlung" element={<Navigate to="/dashboard/paket" replace />} />
                <Route path="profil" element={<BeraterProfile />} />
                <Route path="support" element={<BeraterSupport />} />
                <Route path="pakete" element={<Navigate to="/dashboard/paket" replace />} />
                <Route path="unternehmen" element={<BeraterCompany />} />
                <Route path="sicherheit" element={<BeraterSecurity />} />
                <Route path="guthaben" element={<Navigate to="/dashboard/paket" replace />} />
                <Route path="chancen" element={<Navigate to="/dashboard/leads" replace />} />
                <Route path="aufgaben" element={<Navigate to="/dashboard" replace />} />
              </>
            )}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </DashboardLayout>
        <StammdatenModal />
      </BrokerProvider>
    </DashboardProvider>
  );
}
