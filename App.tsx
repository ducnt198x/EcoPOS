import React from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Tables from './pages/Tables';
import POS from './pages/POS';
import Inventory from './pages/Inventory';
import Reports from './pages/Reports';
import Checkout from './pages/Checkout';
import OrderHistory from './pages/OrderHistory';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import AdminUserCreate from './pages/AdminUserCreate';
import Settings from './pages/Settings';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { Role } from './types';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles: Role[] }> = ({ children, allowedRoles }) => {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background-light dark:bg-background-dark">
         <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user && !allowedRoles.includes(user.role)) {
    // Redirect to a safe page if authorized but wrong role, or just home
    return <Navigate to="/tables" replace />; 
  }

  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      <Route path="/" element={<Navigate to="/login" replace />} />
      
      {/* Admin Specific Routes */}
      <Route path="/admin-dashboard" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminDashboard />
        </ProtectedRoute>
      } />

      <Route path="/admin/create-user" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminUserCreate />
        </ProtectedRoute>
      } />

      <Route path="/tables" element={
        <ProtectedRoute allowedRoles={['admin', 'manager', 'cashier']}>
          <Tables />
        </ProtectedRoute>
      } />
      
      <Route path="/pos" element={
        <ProtectedRoute allowedRoles={['admin', 'manager', 'cashier']}>
          <POS />
        </ProtectedRoute>
      } />
      
      <Route path="/inventory" element={
        <ProtectedRoute allowedRoles={['admin', 'manager']}>
          <Inventory />
        </ProtectedRoute>
      } />
      
      <Route path="/reports" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <Reports />
        </ProtectedRoute>
      } />
      
      <Route path="/checkout" element={
        <ProtectedRoute allowedRoles={['admin', 'manager', 'cashier']}>
          <Checkout />
        </ProtectedRoute>
      } />
      
      <Route path="/order-history" element={
        <ProtectedRoute allowedRoles={['admin', 'manager']}>
          <OrderHistory />
        </ProtectedRoute>
      } />

      <Route path="/settings" element={
        <ProtectedRoute allowedRoles={['admin', 'manager', 'cashier']}>
          <Settings />
        </ProtectedRoute>
      } />
      
      {/* Fallback */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <AuthProvider>
        <DataProvider>
          <HashRouter>
            <Layout>
              <AppRoutes />
            </Layout>
          </HashRouter>
        </DataProvider>
      </AuthProvider>
    </LanguageProvider>
  );
};

export default App;