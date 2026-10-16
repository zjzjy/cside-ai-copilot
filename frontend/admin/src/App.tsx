import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import SidebarLayout from './components/SidebarLayout';
import BrandConfigPage from './pages/BrandConfigPage';
import StoreConfigPage from './pages/StoreConfigPage';
import LoginPage from './pages/LoginPage';

function ProtectedRoute() {
  const token = localStorage.getItem('cside_admin_token');
  if (!token) return <Navigate to="/login" replace />;
  return <SidebarLayout />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route index element={<Navigate to="/brands" replace />} />
          <Route path="brands" element={<BrandConfigPage />} />
          <Route path="stores" element={<StoreConfigPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/brands" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
