import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Tag, PackageCheck, Users, Briefcase, RefreshCw, Wrench, FileCheck, ClipboardList, ShieldAlert } from 'lucide-react';
import useAuthStore, { ROLE_THEMES, ROLES } from '../../store/useAuthStore';

// Sidebar Menu Configuration based on roles
const SIDEBAR_MENUS = {
    [ROLES.BRAND]: [
        { title: '대시보드', path: '/brand', icon: LayoutDashboard },
        { title: '제품 등록 (Mint)', path: '/brand/mint', icon: Tag },
        { title: '출고 관리 (Release)', path: '/brand/release', icon: PackageCheck },
        { title: '위임 기능', path: '/brand/delegate', icon: Briefcase },
        { title: '멤버십 관리', path: '/tenant/memberships', icon: Users },
        { title: '권한 템플릿 관리', path: '/tenant/templates', icon: Briefcase },
    ],
    [ROLES.RETAIL]: [
        { title: '대시보드', path: '/retail', icon: LayoutDashboard },
        { title: '보유 제품 관리', path: '/retail/inventory', icon: PackageCheck },
        { title: '소유권 이전', path: '/retail/transfer', icon: RefreshCw },
        { title: '위임 기능', path: '/retail/delegate', icon: Briefcase },
        { title: '멤버십 관리', path: '/tenant/memberships', icon: Users },
        { title: '권한 템플릿 관리', path: '/tenant/templates', icon: Briefcase },
    ],
    [ROLES.SERVICE]: [
        { title: '대시보드', path: '/service', icon: LayoutDashboard },
        { title: '서비스 요청 관리', path: '/service/requests', icon: ClipboardList },
        { title: '수신 요청 처리', path: '/service/processing', icon: Wrench },
        { title: '완료 이력 관리', path: '/service/history', icon: FileCheck },
        { title: '위임 기능', path: '/service/delegate', icon: Briefcase },
        { title: '멤버십 관리', path: '/tenant/memberships', icon: Users },
        { title: '권한 템플릿 관리', path: '/tenant/templates', icon: Briefcase },
    ],
    [ROLES.PLATFORM_ADMIN]: [
        { title: '업체 승인 관리', path: '/admin/onboarding', icon: ShieldAlert },
        { title: '플랫폼 퍼미션 템플릿', path: '/admin/templates', icon: Briefcase },
    ]
};

const Sidebar = () => {
    const { user } = useAuthStore();

    if (!user) return null;

    const theme = ROLE_THEMES[user.role];
    const menus = SIDEBAR_MENUS[user.role] || [];

    return (
        <aside className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col h-[calc(100vh-4rem)] sticky top-16">
            <div
                className="p-6 mb-4 mt-2 mx-4 rounded-lg shadow-sm"
                style={{ backgroundColor: theme.bg, border: `1px solid ${theme.border}` }}
            >
                <div className="text-xs font-semibold text-gray-500 mb-1">현재 권한 모드</div>
                <div className="font-bold text-lg" style={{ color: theme.primary }}>
                    {theme.name}
                </div>
                <div className="text-xs text-gray-600 mt-2 leading-relaxed">
                    {theme.description}
                </div>
            </div>

            <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
                {menus.map((menu) => (
                    <NavLink
                        key={menu.path}
                        to={menu.path}
                        end={menu.path === `/${user.role.toLowerCase()}`}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${isActive
                                ? 'font-medium bg-white shadow-sm'
                                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                            }`
                        }
                        style={({ isActive }) =>
                            isActive ? { color: theme.primary, borderLeft: `3px solid ${theme.primary}` } : {}
                        }
                    >
                        <menu.icon size={18} />
                        {menu.title}
                    </NavLink>
                ))}
            </nav>

            <div className="p-4 border-t border-gray-200">
                <button className="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                    로그아웃
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
