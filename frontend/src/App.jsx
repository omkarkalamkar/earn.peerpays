import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import InstallPrompt from './components/InstallPrompt';
import { Spinner } from './components/ui';

import Login from './pages/Login';
import AdminOverview from './pages/admin/AdminOverview';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import AdminDeals from './pages/admin/AdminDeals';
import AdminUsers from './pages/admin/AdminUsers';
import AdminOrders from './pages/admin/AdminOrders';
import AdminLedger from './pages/admin/AdminLedger';
import AdminIssues from './pages/admin/AdminIssues';
import AdminPayments from './pages/admin/AdminPayments';
import HolderDeals from './pages/cardholder/HolderDeals';
import HolderCards from './pages/cardholder/HolderCards';
import HolderBookings from './pages/cardholder/HolderBookings';
import HolderLedger from './pages/cardholder/HolderLedger';
import BookerDeals from './pages/booker/BookerDeals';
import BookerOrders from './pages/booker/BookerOrders';
import BookerLedger from './pages/booker/BookerLedger';

const HOME = { admin: '/admin', viewer: '/admin', cardholder: '/holder', booker: '/booker' };

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner label="Loading..." />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={HOME[user.role] || '/login'} replace />;
}

function Shell({ children, roles }) {
  const { user } = useAuth();
  
  return (
    <ProtectedRoute roles={roles}>
      <Layout>{children}</Layout>
      {/* Show install prompt only when logged in */}
      {user && <InstallPrompt />}
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<HomeRedirect />} />

            <Route path="/admin" element={<Shell roles={['admin', 'viewer']}><AdminOverview /></Shell>} />
            <Route path="/admin/analytics" element={<Shell roles={['admin', 'viewer']}><AdminAnalytics /></Shell>} />
            <Route path="/admin/deals" element={<Shell roles={['admin', 'viewer']}><AdminDeals /></Shell>} />
            <Route path="/admin/users" element={<Shell roles={['admin', 'viewer']}><AdminUsers /></Shell>} />
            <Route path="/admin/orders" element={<Shell roles={['admin', 'viewer']}><AdminOrders /></Shell>} />
            <Route path="/admin/ledger" element={<Shell roles={['admin', 'viewer']}><AdminLedger /></Shell>} />
            <Route path="/admin/issues" element={<Shell roles={['admin', 'viewer']}><AdminIssues /></Shell>} />

            <Route path="/holder" element={<Shell roles={['cardholder']}><HolderDeals /></Shell>} />
            <Route path="/holder/cards" element={<Shell roles={['cardholder']}><HolderCards /></Shell>} />
            <Route path="/holder/bookings" element={<Shell roles={['cardholder']}><HolderBookings /></Shell>} />
            <Route path="/holder/ledger" element={<Shell roles={['cardholder']}><HolderLedger /></Shell>} />

            <Route path="/booker" element={<Shell roles={['booker']}><BookerDeals /></Shell>} />
            <Route path="/booker/orders" element={<Shell roles={['booker']}><BookerOrders /></Shell>} />
            <Route path="/booker/ledger" element={<Shell roles={['booker']}><BookerLedger /></Shell>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
