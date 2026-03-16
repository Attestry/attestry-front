import React from 'react';
import { NavLink } from 'react-router-dom';
import { PackageCheck, Users, Briefcase, RefreshCw, Wrench, FileCheck, ClipboardList, ShieldAlert } from 'lucide-react';
import useAuthStore, { ROLE_THEMES, ROLES } from '../../store/useAuthStore';
import { getCurrentMembership } from '../../utils/permissionUi';

const SIDEBAR_MENUS = {
  [ROLES.BRAND]: [
    { title: '출고 관리 (Release)', path: '/brand/release', icon: PackageCheck },
    { title: '유통 관리 (Distribution)', path: '/brand/distribution', icon: RefreshCw },
    { title: '파트너십 관리', path: '/brand/delegate', icon: Briefcase },
    { title: '멤버십 관리', path: '/tenant/memberships', icon: Users },
  ],
  [ROLES.RETAIL]: [
    { title: '보유 제품 관리', path: '/retail/inventory', icon: PackageCheck },
    { title: '양도 완료 물품 관리', path: '/retail/transfer', icon: RefreshCw },
    { title: '파트너십 관리', path: '/retail/delegate', icon: Briefcase },
    { title: '멤버십 관리', path: '/tenant/memberships', icon: Users },
  ],
  [ROLES.SERVICE]: [
    { title: '서비스 요청 관리', path: '/service/requests', icon: ClipboardList },
    { title: '수신 요청 처리', path: '/service/processing', icon: Wrench },
    { title: '완료 이력 관리', path: '/service/history', icon: FileCheck },
    { title: '파트너십 관리', path: '/service/delegate', icon: Briefcase },
    { title: '멤버십 관리', path: '/tenant/memberships', icon: Users },
  ],
  [ROLES.PLATFORM_ADMIN]: [
    { title: '업체 승인 관리', path: '/admin/onboarding', icon: ShieldAlert },
    { title: '디지털 자산 등록 신청 관리', path: '/admin/purchase-claims', icon: ShieldAlert },
  ],
};

const Sidebar = () => {
  const { user, myMemberships } = useAuthStore();

  if (!user) return null;

  const theme = ROLE_THEMES[user.role];
  const currentMembership = getCurrentMembership(myMemberships, user?.tenantId, user?.role);
  const isBrandGroup = currentMembership?.groupType === 'BRAND';

  let menus = SIDEBAR_MENUS[user.role] ? [...SIDEBAR_MENUS[user.role]] : [];

  if (user.role === ROLES.BRAND && isBrandGroup) {
    menus.unshift({ title: '제품 관리 (Product Passports)', path: '/brand/products', icon: PackageCheck });
  }

  return (
    <aside className="w-full border-b border-white/70 bg-[rgba(247,246,242,0.74)] backdrop-blur-xl lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:w-[18rem] lg:border-b-0 lg:border-r lg:border-r-white/80">
      <div className="px-4 pb-4 pt-4 sm:px-6 lg:px-4 lg:pb-5">
        <div
          className="rounded-[1.75rem] p-5 shadow-[0_16px_45px_rgba(15,23,42,0.06)]"
          style={{ backgroundColor: theme.bg, border: `1px solid ${theme.border}` }}
        >
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">현재 역할</div>
          <div className="mt-3 text-xl font-semibold tracking-[-0.04em]" style={{ color: theme.primary }}>
            {theme.name}
          </div>
          <div className="mt-2 text-sm leading-6 text-slate-600">
            {theme.description}
          </div>
        </div>

        <nav className="mt-4 flex gap-3 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0">
          {menus.map((menu) => (
            <NavLink
              key={menu.path}
              to={menu.path}
              end={menu.path === `/${user.role.toLowerCase()}`}
              className={({ isActive }) =>
                `group flex min-w-max items-center gap-3 rounded-full px-4 py-3 text-sm font-medium transition-all lg:min-w-0 lg:rounded-[1.2rem] ${
                  isActive
                    ? 'bg-white shadow-[0_14px_30px_rgba(15,23,42,0.06)]'
                    : 'text-slate-600 hover:bg-white/85 hover:text-slate-900'
                }`
              }
              style={({ isActive }) =>
                isActive ? { color: theme.primary } : {}
              }
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full transition-colors"
                style={{
                  backgroundColor: `${theme.primary}14`,
                  color: theme.primary,
                }}
              >
                <menu.icon size={17} />
              </div>
              <span className="whitespace-nowrap lg:whitespace-normal">{menu.title}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </aside>
  );
};

export default Sidebar;
