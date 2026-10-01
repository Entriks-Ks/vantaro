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
  BeraterSettings,
  BeraterCalendar,
  BeraterSupport,
  BeraterAcademy,
} from './dashboard/BeraterViews';
import { BeraterBilling } from './dashboard/BeraterBilling';
import {
  AdminOverview,
  AdminUsers,
  AdminProfile,
} from './dashboard/AdminViews';
import { AdminPayment } from './dashboard/AdminPayments';
import { AdminLeadEditor, AdminLeads } from './dashboard/AdminLeads';
import { AdminBeraterDetail, AdminBeraterList } from './dashboard/AdminBerater';
import { AdminRequests } from './dashboard/AdminRequests';
import { AdminRequestDetail } from './dashboard/AdminRequestDetail';
import { AdminComplaints } from './dashboard/AdminComplaints';
import { AdminRejectedLeads } from './dashboard/AdminRejectedLeads';
import EnergyLeadEditor from './dashboard/EnergyLeadEditor';
import {
  EnergyHome,
  EnergyOrders,
} from './dashboard/EnergyViews';
import { PartnersPage } from './dashboard/EnergyOps';
import VerticalChoice from './VerticalChoice';
import { allowedPartnerPages } from '../lib/partners';

function RedirectAnfordernDetail() {
  const { id } = useParams();
  return <Navigate to={`/dashboard/anfordern/${id}`} replace />;
}

export default function Dashboard() {
  const { isAdmin, user } = useAuth();
  const energy = !isAdmin && user?.vertical === 'energy';
  const partnerPages = isAdmin ? null : allowedPartnerPages(user);
  const companyMain = !isAdmin && !partnerPages;
  const canPage = (pageId) => !partnerPages || partnerPages.includes(pageId);
  const firstPage = `/dashboard/${partnerPages?.find((id) => id !== 'dashboard') || 'profil'}`;

  if (!isAdmin && user?.needsVertical) return <VerticalChoice />;

  return (
    <DashboardProvider>
      <BrokerProvider>
        <DashboardLayout>
          <Routes>
            <Route
              index
              element={
                isAdmin
                  ? <AdminOverview />
                  : (!canPage('dashboard')
                    ? <Navigate to={firstPage} replace />
                    : (energy ? <EnergyHome /> : <BeraterHome />))
              }
            />
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
                <Route path="leads" element={<AdminLeads key="leads" />} />
                <Route path="termine" element={<AdminLeads key="termine" mode="termine" />} />
                <Route path="leads/energy/new" element={<EnergyLeadEditor />} />
                <Route path="leads/energy/:leadId" element={<EnergyLeadEditor />} />
                <Route path="leads/new" element={<AdminLeadEditor />} />
                <Route path="leads/ungueltig" element={<AdminRejectedLeads />} />
                <Route path="leads/abgelehnt" element={<Navigate to="/dashboard/leads/ungueltig" replace />} />
                <Route path="leads/:id" element={<AdminLeadEditor />} />
                <Route path="energie" element={<Navigate to="/dashboard/leads" replace />} />
                <Route path="zahlung" element={<AdminPayment />} />
                <Route path="profil" element={<AdminProfile />} />
                <Route path="unternehmen" element={<Navigate to="/dashboard/profil" replace />} />
                <Route path="sicherheit" element={<Navigate to="/dashboard/profil" replace />} />
                <Route path="einstellungen" element={<Navigate to="/dashboard/profil" replace />} />
                <Route path="users" element={<Navigate to="/dashboard/nutzer" replace />} />
                <Route path="payment" element={<Navigate to="/dashboard/zahlung" replace />} />
              </>
            ) : (
              <>
                <Route path="leads" element={canPage('leads') ? <BeraterLeads /> : <Navigate to="/dashboard" replace />} />
                <Route path="leads/:leadId" element={canPage('leads') ? <BeraterLeadDetail /> : <Navigate to="/dashboard" replace />} />
                <Route path="kalender" element={canPage('kalender') ? <BeraterCalendar /> : <Navigate to="/dashboard" replace />} />
                <Route path="bestellung" element={<Navigate to="/dashboard/paket" replace />} />
                <Route path="team" element={companyMain ? <PartnersPage /> : <Navigate to="/dashboard" replace />} />
                <Route path="abrechnung" element={<Navigate to="/dashboard/paket" replace />} />
                <Route path="reklamationen" element={energy ? <Navigate to="/dashboard/leads" replace /> : <Navigate to="/dashboard" replace />} />
                <Route path="paket" element={
                  !canPage('paket')
                    ? <Navigate to="/dashboard" replace />
                    : (energy ? <EnergyOrders /> : <BeraterPayments />)
                } />
                <Route path="zahlung" element={canPage('paket') ? <BeraterBilling /> : <Navigate to="/dashboard" replace />} />
                <Route path="partner" element={companyMain ? <PartnersPage /> : <Navigate to="/dashboard" replace />} />
                <Route path="academy" element={canPage('academy') ? <BeraterAcademy /> : <Navigate to="/dashboard" replace />} />
                <Route path="profil" element={<BeraterProfile />} />
                <Route path="support" element={canPage('support') ? <BeraterSupport /> : <Navigate to="/dashboard" replace />} />
                <Route path="pakete" element={<Navigate to="/dashboard/paket" replace />} />
                <Route path="unternehmen" element={<BeraterCompany />} />
                <Route path="sicherheit" element={<BeraterSecurity />} />
                <Route path="einstellungen" element={<BeraterSettings />} />
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
