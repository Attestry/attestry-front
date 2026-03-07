import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import useAuthStore, { ROLES } from './store/useAuthStore';
import DashboardLayout from './components/layout/DashboardLayout';
import MainLayout from './components/layout/MainLayout';
import BrandView from './pages/brand/BrandView';
import RetailView from './pages/retail/RetailView';
import ServiceView from './pages/service/ServiceView';
import MainPage from './pages/main/MainPage';
import OnboardingView from './pages/onboarding/OnboardingView';
import PlatformAdminView from './pages/admin/PlatformAdminView';
import TenantMembershipAdmin from './pages/tenant/TenantMembershipAdmin';
import PlatformTemplateAdmin from './pages/admin/templates/PlatformTemplateAdmin';
import LoginPage from './pages/auth/LoginPage';
import SignupPage from './pages/auth/SignupPage';
import InvitationAccept from './pages/invitations/InvitationAccept';
import MyPage from './pages/mypage/MyPage';
import PartnershipAdmin from './pages/partnership/PartnershipAdmin';
import ProductManagement from './pages/product/ProductManagement';
import PurchaseClaimView from './pages/claim/PurchaseClaimView';
import PurchaseClaimAdminView from './pages/claim/PurchaseClaimAdminView';
import TransferReceiveView from './pages/transfer/TransferReceiveView';
import ProductDetail from './pages/product/ProductDetail';
import ShipmentManagement from './pages/shipment/ShipmentManagement';
import ShipmentHistoryDetail from './pages/shipment/ShipmentHistoryDetail';
import PurchaseClaimView from './pages/claim/PurchaseClaimView';
import PurchaseClaimAdminView from './pages/claim/PurchaseClaimAdminView';
import TransferReceiveView from './pages/transfer/TransferReceiveView';
import ProductDetail from './pages/product/ProductDetail';
import ShipmentManagement from './pages/shipment/ShipmentManagement';
import ShipmentHistoryDetail from './pages/shipment/ShipmentHistoryDetail';

const ProtectedRoute = ({ allowedRoles, children }) => {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user) return <div className="p-20 text-center text-gray-400">권한 확인 중...</div>;

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === ROLES.USER) {
      return <Navigate to="/" replace />;
    } else if (user.role === ROLES.PLATFORM_ADMIN) {
      return <Navigate to="/admin/onboarding" replace />;
    }
    return <Navigate to={`/${user.role.toLowerCase()}`} replace />;
  }

  return children;
};

const DashboardRedirector = () => {
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    if (user.role === ROLES.USER) {
      navigate('/', { replace: true });
    } else if (user.role === ROLES.PLATFORM_ADMIN) {
      navigate('/admin/onboarding', { replace: true });
    } else {
      navigate(`/${user.role.toLowerCase()}`, { replace: true });
    }
  }, [user?.role, isAuthenticated, navigate]);

  return null;
};

const App = () => {
  const { isAuthenticated, fetchMyMemberships } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      fetchMyMemberships();
    }
  }, [isAuthenticated, fetchMyMemberships]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/invitations/:invitationId/accept" element={<InvitationAccept />} />

        <Route element={<MainLayout />}>
          <Route path="/" element={<MainPage />} />
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <OnboardingView />
              </ProtectedRoute>
            }
          />
          <Route path="/transfer/receive" element={<TransferReceiveView />} />
          <Route
            path="/purchase-claims"
            element={
              <ProtectedRoute allowedRoles={[ROLES.USER]}>
                <PurchaseClaimView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mypage"
            element={
              <ProtectedRoute>
                <MyPage />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<DashboardRedirector />} />

          <Route path="/tenant">
            <Route
              path="memberships"
              element={
                <ProtectedRoute allowedRoles={[ROLES.BRAND, ROLES.RETAIL, ROLES.SERVICE]}>
                  <TenantMembershipAdmin />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="/brand">
            <Route index element={
              <ProtectedRoute allowedRoles={[ROLES.BRAND]}>
                <BrandView />
              </ProtectedRoute>
            } />
            <Route path="release" element={
              <ProtectedRoute allowedRoles={[ROLES.BRAND]}>
                <ShipmentManagement />
              </ProtectedRoute>
            } />
            <Route path="shipments/:shipmentId" element={
              <ProtectedRoute allowedRoles={[ROLES.BRAND]}>
                <ShipmentHistoryDetail />
              </ProtectedRoute>
            } />
            <Route path="delegate" element={
              <ProtectedRoute allowedRoles={[ROLES.BRAND]}>
                <PartnershipAdmin />
              </ProtectedRoute>
            } />
            <Route path="products" element={
              <ProtectedRoute allowedRoles={[ROLES.BRAND]}>
                <ProductManagement />
              </ProtectedRoute>
            } />
            <Route path="products/:passportId" element={
              <ProtectedRoute allowedRoles={[ROLES.BRAND]}>
                <ProductDetail />
              </ProtectedRoute>
            } />
            <Route path="*" element={<div className="p-8 font-bold">준비중인 메뉴입니다.</div>} />
          </Route>

          <Route path="/retail">
            <Route
              index
              element={
                <ProtectedRoute allowedRoles={[ROLES.RETAIL]}>
                  <RetailView />
                </ProtectedRoute>
              }
            />
            <Route path="inventory" element={<div className="p-8 font-bold">보유 제품 관리 기능 개발중...</div>} />
            <Route path="transfer" element={<div className="p-8 font-bold">소유권 이전 기능 개발중...</div>} />
            <Route
              path="delegate"
              element={
                <ProtectedRoute allowedRoles={[ROLES.RETAIL]}>
                  <PartnershipAdmin />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<div className="p-8 font-bold">준비중인 메뉴입니다.</div>} />
          </Route>

          <Route path="/service">
            <Route
              index
              element={
                <ProtectedRoute allowedRoles={[ROLES.SERVICE]}>
                  <ServiceView />
                </ProtectedRoute>
              }
            />
            <Route path="requests" element={<div className="p-8 font-bold">서비스 요청 관리 기능 개발중...</div>} />
            <Route path="processing" element={<div className="p-8 font-bold">수신 요청 처리 기능 개발중...</div>} />
            <Route path="history" element={<div className="p-8 font-bold">완료 이력 관리 기능 개발중...</div>} />
            <Route
              path="delegate"
              element={
                <ProtectedRoute allowedRoles={[ROLES.SERVICE]}>
                  <PartnershipAdmin />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<div className="p-8 font-bold">준비중인 메뉴입니다.</div>} />
          </Route>

          <Route path="/admin">
            <Route
              path="onboarding"
              element={
                <ProtectedRoute allowedRoles={[ROLES.PLATFORM_ADMIN]}>
                  <PlatformAdminView />
                </ProtectedRoute>
              }
            />
            <Route
              path="purchase-claims"
              element={
                <ProtectedRoute allowedRoles={[ROLES.PLATFORM_ADMIN]}>
                  <PurchaseClaimAdminView />
                </ProtectedRoute>
              }
            />
            <Route
              path="templates"
              element={
                <ProtectedRoute allowedRoles={[ROLES.PLATFORM_ADMIN]}>
                  <PlatformTemplateAdmin />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<div className="p-8 font-bold">준비중인 메뉴입니다.</div>} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
