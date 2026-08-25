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
  AdminQuality,
  AdminMatching,
} from './dashboard/AdminViews';

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
                <Route path="qualitaet" element={<AdminQuality />} />
                <Route path="matching" element={<AdminMatching />} />
                <Route path="profil" element={<BeraterProfile />} />
                <Route path="unternehmen" element={<BeraterCompany />} />
                <Route path="sicherheit" element={<BeraterSecurity />} />
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
