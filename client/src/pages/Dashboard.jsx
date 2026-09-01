import { Navigate, Route, Routes } from 'react-router-dom';
import StammdatenModal from '../components/StammdatenModal';
import { useAuth } from '../hooks/useAuth';
import { BrokerProvider } from '../hooks/useBroker';
import { DashboardProvider } from '../hooks/useDashboard';
import DashboardLayout from './dashboard/DashboardLayout';
import {
  BeraterLeads,
  BeraterPayments,
  BeraterProfile,
} from './dashboard/BeraterViews';
import {
  AdminOverview,
  AdminUsers,
  AdminPayment,
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
            <Route index element={isAdmin ? <AdminOverview /> : <BeraterLeads />} />
            {isAdmin ? (
              <>
                <Route path="nutzer" element={<AdminUsers />} />
                <Route path="berater" element={<AdminBeraterList />} />
                <Route path="berater/:id" element={<AdminBeraterDetail />} />
                <Route path="anfragen" element={<AdminRequests />} />
                <Route path="reklamationen" element={<AdminComplaints />} />
                <Route path="leads" element={<AdminLeads />} />
                <Route path="leads/new" element={<AdminLeadEditor />} />
                <Route path="leads/abgelehnt" element={<AdminRejectedLeads />} />
                <Route path="leads/:id" element={<AdminLeadEditor />} />
                <Route path="zahlung" element={<AdminPayment />} />
                <Route path="profil" element={<BeraterProfile />} />
                <Route path="users" element={<Navigate to="/dashboard/nutzer" replace />} />
                <Route path="payment" element={<Navigate to="/dashboard/zahlung" replace />} />
              </>
            ) : (
              <>
                <Route path="zahlung" element={<BeraterPayments />} />
                <Route path="profil" element={<BeraterProfile />} />
                <Route path="guthaben" element={<Navigate to="/dashboard/zahlung" replace />} />
                <Route path="chancen" element={<Navigate to="/dashboard" replace />} />
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
