import React from 'react';
import { Bell, User } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { flushSync } from 'react-dom';
import useAuthStore, { ROLE_THEMES, ROLES } from '../../store/useAuthStore';
import { getRoleLandingPath } from '../../utils/roleNavigation';

const TopNav = () => {
    const { user, setRole, reissueToken } = useAuthStore();
    const navigate = useNavigate();

    if (!user) return null;

    const theme = ROLE_THEMES[user.role] || ROLE_THEMES[ROLES.USER];
    const homePath = getRoleLandingPath(user.role);

    return (
        <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 sticky top-0 z-10">
            <div className="flex items-center gap-4">
                <button
                    type="button"
                    onClick={() => navigate(homePath)}
                    className="flex items-center gap-2 font-bold text-xl text-gray-800"
                >
                    <div className="bg-gray-900 text-white w-8 h-8 rounded-md flex items-center justify-center font-bold">
                        D
                    </div>
                    DPP Ledger
                </button>
            </div>

            <div className="flex items-center gap-4">
                {user?.availableRoles?.length > 1 && (
                    <select
                        className="text-sm border border-gray-300 rounded-md py-1.5 px-3 bg-white text-gray-700 font-medium shadow-sm transition-colors hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900"
                        value={user.role}
                        onChange={async (e) => {
                            const newRole = e.target.value;
                            flushSync(() => setRole(newRole));
                            await reissueToken();
                            navigate(getRoleLandingPath(newRole));
                        }}
                    >
                        {user.availableRoles.map(r => (
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

                <button className="text-gray-500 hover:text-gray-700">
                    <Bell size={20} />
                </button>
                <div className="flex items-center gap-2">
                    <Link to="/mypage"
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white hover:opacity-80 transition-opacity"
                        style={{ backgroundColor: theme.primary }}
                    >
                        <User size={16} />
                    </Link>
                    <Link to="/mypage" className="text-sm font-medium text-gray-700 hover:text-gray-900">{user.email || '사용자'}</Link>
                </div>
                <button
                    onClick={() => useAuthStore.getState().logout()}
                    className="ml-2 text-sm text-gray-500 hover:text-red-500 font-medium"
                >
                    로그아웃
                </button>
            </div>
        </header>
    );
};

export default TopNav;
