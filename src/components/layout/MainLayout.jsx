import React, { useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import useAuthStore, { ROLES } from '../../store/useAuthStore';
import { ChevronRight, Menu, X } from 'lucide-react';
import { getRoleLandingPath } from '../../utils/roleNavigation';
import TraceraLogo from './TraceraLogo';
import AccountMenu from './AccountMenu';

const MainLayout = () => {
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isUserProfile = isAuthenticated && user?.role === ROLES.USER;
  const homePath = isAuthenticated ? getRoleLandingPath(user?.role) : '/';
  const userQuickLinks = [
    { to: '/transfer/receive', label: '소유권 이전 받기' },
    { to: '/purchase-claims', label: '제품 등록 신청' },
    { to: '/service-request/providers', label: '서비스 신청' },
  ];
  const getFeatureHref = (to) => (isAuthenticated ? to : `/login?returnTo=${encodeURIComponent(to)}`);

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="min-h-screen bg-[var(--color-page)] flex flex-col text-slate-900">
      <header className="sticky top-0 z-30 w-full border-b border-white/60 bg-[rgba(248,246,241,0.8)] backdrop-blur-xl">
        <div className="mx-auto flex h-[4.5rem] w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <TraceraLogo to={homePath} onClick={closeMobileMenu} compact />
          </div>

          <div className="hidden items-center gap-2 md:flex">
            {userQuickLinks.map((item) => (
              <Link key={item.to} to={getFeatureHref(item.to)} className="px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-950">
                {item.label}
              </Link>
            ))}
          </div>

          <div className="hidden items-center gap-4 md:flex">
          {isAuthenticated ? (
            <div className="flex items-center gap-4">
              <AccountMenu user={user} navigate={navigate} />
            </div>
          ) : (
            <div className="flex gap-2">
              <Link to="/login" className="tracera-button-secondary rounded-xl px-4 py-2.5 shadow-none" style={{ color: '#0f172a' }}>로그인</Link>
              <Link to="/signup" className="tracera-button-primary rounded-xl px-5 py-2.5" style={{ color: '#ffffff', WebkitTextFillColor: '#ffffff' }}>
                회원가입
              </Link>
            </div>
          )}
          </div>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 md:hidden"
            aria-label="메뉴 열기"
          >
            {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {isMobileMenuOpen && (
          <div className="border-t border-slate-200/80 bg-[rgba(248,246,241,0.96)] px-4 py-4 md:hidden">
            <div className="mx-auto flex max-w-7xl flex-col gap-3">
              {userQuickLinks.map((item) => (
                <Link key={item.to} to={getFeatureHref(item.to)} onClick={closeMobileMenu} className="tracera-panel-soft px-4 py-3 text-sm font-medium text-slate-700">
                  {item.label}
                </Link>
              ))}
              {isAuthenticated ? (
                <>
                  <Link to="/mypage" onClick={closeMobileMenu} className="tracera-panel-soft px-4 py-3 text-sm font-medium text-slate-700">
                    마이페이지
                  </Link>
                  <button
                    onClick={() => {
                      closeMobileMenu();
                      useAuthStore.getState().logout();
                      navigate('/');
                    }}
                    className="tracera-button-primary justify-start rounded-2xl px-4 py-3 text-left"
                  >
                    로그아웃
                  </button>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Link to="/login" onClick={closeMobileMenu} className="tracera-button-secondary rounded-xl px-4 py-3" style={{ color: '#0f172a' }}>
                    로그인
                  </Link>
                  <Link to="/signup" onClick={closeMobileMenu} className="tracera-button-primary rounded-xl px-4 py-3" style={{ color: '#ffffff', WebkitTextFillColor: '#ffffff' }}>
                    회원가입
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="w-full flex-1">
        <Outlet />
      </main>

      <footer className="mt-auto border-t border-[rgba(148,163,184,0.15)] bg-[linear-gradient(180deg,#0b1220_0%,#0f172a_100%)] py-12 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 sm:px-6 lg:px-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <TraceraLogo to={homePath} subtitle={false} compact tone="dark" />
            <p className="mt-5 max-w-xl text-sm leading-7 text-slate-300">
              제품 이력과 소유권, 서비스 흐름을 하나의 신뢰 가능한 기록으로 연결합니다.
            </p>
            <div className="mt-5 flex flex-wrap gap-3 text-xs text-slate-400">
              <span className="tracera-badge border-white/10 bg-white/5 text-slate-300 shadow-none">제품 생애주기</span>
              <span className="tracera-badge border-white/10 bg-white/5 text-slate-300 shadow-none">소유권 추적</span>
              <span className="tracera-badge border-white/10 bg-white/5 text-slate-300 shadow-none">서비스 이력</span>
            </div>
          </div>
          <div className="grid gap-3 text-sm text-slate-400">
            <div className="font-medium text-slate-200">Proveny</div>
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-stone-300">
              <span className="h-px w-8 bg-stone-500/70" />
              Product 민영 & 선욱
            </div>
            <Link to="/onboarding" className="inline-flex items-center gap-2 transition-colors hover:text-white">
              업체 신청 페이지
              <ChevronRight size={15} />
            </Link>
            <div>© 2026 Proveny. The new era of product traceability.</div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default MainLayout;
