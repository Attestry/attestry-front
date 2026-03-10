import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { flushSync } from 'react-dom';
import useAuthStore, { ROLES } from '../../store/useAuthStore';
import { User } from 'lucide-react';

const MainLayout = () => {
  const { user, setRole, reissueToken, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  const isUserProfile = isAuthenticated && user?.role === ROLES.USER;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 sticky top-0 z-10 w-full">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl text-gray-800">
            <div className="bg-gray-900 text-white w-8 h-8 rounded-md flex items-center justify-center font-bold">
              D
            </div>
            DPP Ledger
          </Link>
        </div>

        <div className="flex gap-8 text-sm font-medium text-gray-600 hidden md:flex">
          {isUserProfile && (
            <>
              <Link to="/transfer/receive" className="text-blue-600 hover:text-blue-700 font-semibold">디지털 자산 이전 받기</Link>
              <Link to="/purchase-claims" className="text-blue-600 hover:text-blue-700 font-semibold">디지털 자산 등록하기</Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <div className="flex items-center gap-4">
              {user?.availableRoles?.length > 1 && (
                <select
                  className="text-sm border border-gray-300 rounded-md py-1.5 px-3 bg-white text-gray-700 font-medium shadow-sm transition-colors hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  value={user?.role}
                  onChange={async (e) => {
                    const newRole = e.target.value;
                    flushSync(() => setRole(newRole));
                    await reissueToken();
                    if (newRole === ROLES.PLATFORM_ADMIN) {
                      navigate('/admin/onboarding');
                    } else if (newRole === ROLES.USER) {
                      navigate('/');
                    } else {
                      navigate(`/${newRole.toLowerCase()}`);
                    }
                  }}
                >
                  {user.availableRoles.map((r) => (
                    <option key={r} value={r}>
                      프로필: {r === ROLES.USER ? '일반 사용자' :
                        r === ROLES.BRAND ? '제조 (Brand)' :
                          r === ROLES.RETAIL ? '유통 (Retail)' :
                            r === ROLES.SERVICE ? '서비스 (Service)' :
                              '플랫폼 관리자'}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex items-center gap-2">
                <Link to="/mypage" className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-300 transition-colors">
                  <User size={16} />
                </Link>
                <Link to="/mypage" className="text-sm font-medium text-gray-700 hidden sm:block hover:text-gray-900">{user?.email || '사용자'}</Link>
              </div>
              <button
                onClick={() => {
                  useAuthStore.getState().logout();
                  navigate('/');
                }}
                className="text-sm font-medium text-gray-500 hover:text-red-600 pl-4 border-l border-gray-200"
              >
                로그아웃
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2">로그인</Link>
              <Link to="/signup" className="text-sm font-medium bg-gray-900 text-white rounded-md px-4 py-2 hover:bg-gray-800">회원가입</Link>
            </div>
          )}
        </div>
      </header>

      <main className="w-full flex-1">
        <Outlet />
      </main>

      <footer className="bg-white border-t border-gray-200 py-8 mt-auto">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm text-gray-500">
          <p>© 2026 DPP Ledger. 투명한 디지털 환경을 만듭니다.</p>
        </div>
      </footer>
    </div>
  );
};

export default MainLayout;
