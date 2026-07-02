import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';

import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import QuoteList from './pages/QuoteList';
import QuoteForm from './pages/QuoteForm';
import Import from './pages/Import';
import QuotePreview from './pages/QuotePreview';
import Summary from './pages/Summary';
import SenderProfiles from './pages/SenderProfiles';
import Customers from './pages/Customers';
import DataManagement from './pages/DataManagement';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <Routes>
      {/* 認証 */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ForgotPassword />} />

      {/* アプリ */}
      <Route path="/" element={<RequireAuth><QuoteList /></RequireAuth>} />
      <Route path="/quotes/new" element={<RequireAuth><QuoteForm /></RequireAuth>} />
      <Route path="/import" element={<RequireAuth><Import /></RequireAuth>} />
      <Route path="/quotes/:id" element={<RequireAuth><QuotePreview /></RequireAuth>} />
      <Route path="/quotes/:id/edit" element={<RequireAuth><QuoteForm /></RequireAuth>} />
      <Route path="/summary" element={<RequireAuth><Summary /></RequireAuth>} />
      <Route path="/sender-profiles" element={<RequireAuth><SenderProfiles /></RequireAuth>} />
      <Route path="/customers" element={<RequireAuth><Customers /></RequireAuth>} />
      <Route path="/data" element={<RequireAuth><DataManagement /></RequireAuth>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
