import { Navigate, Route, Routes } from 'react-router-dom';
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
import { AdminComplaints } from './dashboard/AdminComplaints';
import { AdminRejectedLeads } from './dashboard/AdminRejectedLeads';

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
                <Route path="anfragen" element={<Navigate to="/dashboard/anfordern" replace />} />
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
                <Route path="zahlung" element={<BeraterPayments />} />
                <Route path="pakete" element={<Navigate to="/dashboard/zahlung" replace />} />
                <Route path="profil" element={<BeraterProfile />} />
                <Route path="unternehmen" element={<BeraterCompany />} />
                <Route path="sicherheit" element={<BeraterSecurity />} />
                <Route path="guthaben" element={<Navigate to="/dashboard/zahlung" replace />} />
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
