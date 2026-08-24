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
            <Route index element={isAdmin ? <AdminOverview /> : <BeraterLeads />} />
            {isAdmin ? (
              <>
                <Route path="nutzer" element={<AdminUsers />} />
                <Route path="qualitaet" element={<AdminQuality />} />
                <Route path="matching" element={<AdminMatching />} />
                <Route path="profil" element={<BeraterProfile />} />
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
