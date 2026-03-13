import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import useAuthStore, { ROLES } from './store/useAuthStore';
import DashboardLayout from './components/layout/DashboardLayout';
import MainLayout from './components/layout/MainLayout';
import RetailView from './pages/retail/RetailView';
import RetailInventoryView from './pages/retail/RetailInventoryView';
import RetailBrandInventoryDetail from './pages/retail/RetailBrandInventoryDetail';
import RetailTransferBrandListView from './pages/retail/RetailTransferBrandListView';
import RetailBrandCompletedTransfersDetail from './pages/retail/RetailBrandCompletedTransfersDetail';
import RetailDistributedProductDetail from './pages/retail/RetailDistributedProductDetail';
import ServiceView from './pages/service/ServiceView';
import ServiceRequestsPage from './pages/service/ServiceRequestsPage';
import ServiceProcessingPage from './pages/service/ServiceProcessingPage';
import ServiceHistoryPage from './pages/service/ServiceHistoryPage';
import ServiceProviderListPage from './pages/service/ServiceProviderListPage';
import ServiceProviderDetailPage from './pages/service/ServiceProviderDetailPage';
import MyServiceRequestsUserPage from './pages/service/MyServiceRequestsUserPage';
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
import DistributionManagement from './pages/distribution/DistributionManagement';
import PublicPassportView from './pages/product/PublicPassportView';
import { getRoleLandingPath } from './utils/roleNavigation';
import { AUTH_EVENT_NAME } from './utils/authSession';

const ProtectedRoute = ({ allowedRoles, children }) => {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user) return <div className="p-20 text-center text-gray-400">권한 확인 중...</div>;

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={getRoleLandingPath(user.role)} replace />;
  }

  return children;
};

const DashboardRedirector = () => {
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    navigate(getRoleLandingPath(user.role), { replace: true });
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

  useEffect(() => {
    const handleAuthExpired = () => {
      useAuthStore.getState().setToken(null);
    };

    window.addEventListener(AUTH_EVENT_NAME, handleAuthExpired);
    return () => window.removeEventListener(AUTH_EVENT_NAME, handleAuthExpired);
  }, []);

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
          <Route
            path="/transfer/receive"
            element={
              <ProtectedRoute>
                <TransferReceiveView />
              </ProtectedRoute>
            }
          />
          <Route path="/t/:transferId" element={<TransferReceiveView />} />
          <Route path="/t/:transferId/:qrNonce" element={<TransferReceiveView />} />
          <Route path="/products/passports/:passportId" element={<PublicPassportView />} />
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
          <Route
            path="/service-request/providers"
            element={
              <ProtectedRoute allowedRoles={[ROLES.USER]}>
                <ServiceProviderListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/service-request/providers/:tenantId"
            element={
              <ProtectedRoute allowedRoles={[ROLES.USER]}>
                <ServiceProviderDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/service-request/my"
            element={
              <ProtectedRoute allowedRoles={[ROLES.USER]}>
                <MyServiceRequestsUserPage />
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
                <Navigate to={getRoleLandingPath(ROLES.BRAND)} replace />
              </ProtectedRoute>
            } />
            <Route path="release" element={
              <ProtectedRoute allowedRoles={[ROLES.BRAND]}>
                <ShipmentManagement />
              </ProtectedRoute>
            } />
            <Route path="distribution" element={
              <ProtectedRoute allowedRoles={[ROLES.BRAND]}>
                <DistributionManagement />
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
                  <Navigate to={getRoleLandingPath(ROLES.RETAIL)} replace />
                </ProtectedRoute>
              }
            />
            <Route
              path="inventory"
              element={
                <ProtectedRoute allowedRoles={[ROLES.RETAIL]}>
                  <RetailInventoryView />
                </ProtectedRoute>
              }
            />
                        <Route
              path="inventory/:brandTenantId"
              element={
                <ProtectedRoute allowedRoles={[ROLES.RETAIL]}>
                  <RetailBrandInventoryDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="transfer"
              element={
                <ProtectedRoute allowedRoles={[ROLES.RETAIL]}>
                  <RetailTransferBrandListView />
                </ProtectedRoute>
              }
            />
            <Route
              path="transfer/:brandTenantId"
              element={
                <ProtectedRoute allowedRoles={[ROLES.RETAIL]}>
                  <RetailBrandCompletedTransfersDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="products/:passportId"
              element={
                <ProtectedRoute allowedRoles={[ROLES.RETAIL]}>
                  <RetailDistributedProductDetail />
                </ProtectedRoute>
              }
            />
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
                  <Navigate to={getRoleLandingPath(ROLES.SERVICE)} replace />
                </ProtectedRoute>
              }
            />
            <Route
              path="requests"
              element={
                <ProtectedRoute allowedRoles={[ROLES.SERVICE]}>
                  <ServiceRequestsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="processing"
              element={
                <ProtectedRoute allowedRoles={[ROLES.SERVICE]}>
                  <ServiceProcessingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="history"
              element={
                <ProtectedRoute allowedRoles={[ROLES.SERVICE]}>
                  <ServiceHistoryPage />
                </ProtectedRoute>
              }
            />
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
