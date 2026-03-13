import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import useAuthStore, { ROLES } from '../../store/useAuthStore';
import { getRoleLandingPath } from '../../utils/roleNavigation';

const labelForRole = (role) => (
  role === ROLES.USER ? '개인' :
    role === ROLES.BRAND ? '브랜드' :
      role === ROLES.RETAIL ? '리테일' :
        role === ROLES.SERVICE ? '서비스' :
          '플랫폼 관리자'
);

const AccountMenu = ({ user, navigate }) => {
  const { switchRole } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!ref.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const changeRole = async (role) => {
    const result = await switchRole(role);
    if (!result?.success) {
      alert(result?.message || '프로필 전환에 실패했습니다.');
      return;
    }
    navigate(getRoleLandingPath(role));
    setIsOpen(false);
  };

  const currentRoleLabel = labelForRole(user?.role);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-3 rounded-full border border-slate-200 bg-white/92 px-3 py-2 shadow-sm transition-all hover:border-slate-300"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-white shadow-sm">
          <User size={16} />
        </div>
        <div className="hidden text-left sm:block">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">계정</div>
          <div className="text-sm font-semibold text-slate-800">{currentRoleLabel}</div>
        </div>
        <ChevronDown size={16} className={`text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-[calc(100%+0.75rem)] z-40 w-[19rem] overflow-hidden rounded-[1.5rem] border border-white/80 bg-[rgba(255,255,255,0.92)] shadow-[0_28px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl">
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">프로필</div>
            <div className="mt-2 truncate text-sm font-semibold text-slate-900">{user?.email || '사용자'}</div>
          </div>

          <div className="px-3 py-3">
            <Link
              to="/mypage"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-between rounded-[1.1rem] px-3 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-950"
            >
              <span>마이페이지</span>
              <User size={15} className="text-slate-400" />
            </Link>
          </div>

          {user?.availableRoles?.length > 1 && (
            <div className="border-t border-slate-100 px-3 py-3">
              <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">프로필 선택</div>
              <div className="space-y-1">
                {user.availableRoles.map((role) => {
                  const active = role === user.role;
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => changeRole(role)}
                      className={`flex w-full items-center justify-between rounded-[1.1rem] px-3 py-3 text-left text-sm font-medium transition-all ${
                        active
                          ? 'bg-slate-950 text-white shadow-sm'
                          : 'text-slate-700 hover:bg-slate-50 hover:text-slate-950'
                      }`}
                    >
                      <span>{labelForRole(role)}</span>
                      {active && <span className="text-xs font-semibold text-slate-300">현재</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="border-t border-slate-100 px-3 py-3">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                useAuthStore.getState().logout();
                navigate('/');
              }}
              className="flex w-full items-center justify-between rounded-[1.1rem] px-3 py-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
            >
              <span>로그아웃</span>
              <LogOut size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountMenu;
