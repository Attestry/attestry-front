import React from 'react';
import { Menu, Bell, User, LayoutDashboard, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useAuthStore, { ROLE_THEMES, ROLES } from '../../store/useAuthStore';

const TopNav = () => {
    const { user, setRole } = useAuthStore();
    const navigate = useNavigate();

    if (!user) return null;

    const theme = ROLE_THEMES[user.role] || ROLE_THEMES[ROLES.USER];

    return (
        <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 sticky top-0 z-10">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 font-bold text-xl text-gray-800">
                    <div className="bg-gray-900 text-white w-8 h-8 rounded-md flex items-center justify-center font-bold">
                        D
                    </div>
                    DPP Ledger
                </div>
            </div>

            <div className="flex gap-6 text-sm font-medium text-gray-600">
                <a href="#" className="hover:text-gray-900">기능</a>
                <a href="#" className="hover:text-gray-900">솔루션</a>
                <a href="#" className="hover:text-gray-900">소개</a>
            </div>

            <div className="flex items-center gap-4">
                {user?.availableRoles?.length > 1 && (
                    <select
                        className="text-sm border rounded-md py-1.5 px-3 bg-white shadow-sm font-medium transition-colors focus:outline-none focus:ring-2"
                        value={user.role}
                        onChange={(e) => {
                            const newRole = e.target.value;
                            setRole(newRole);
                            if (newRole === ROLES.USER) {
                                navigate('/');
                            } else if (newRole === ROLES.PLATFORM_ADMIN) {
                                navigate('/admin/onboarding');
                            } else {
                                navigate(`/${newRole.toLowerCase()}`);
                            }
                        }}
                        style={{ borderColor: theme.border, color: theme.primary }}
                    >
                        {user.availableRoles.map(r => (
                            <option key={r} value={r}>
                                전환: {ROLE_THEMES[r]?.name || r}
                            </option>
                        ))}
                    </select>
                )}

                <button className="text-gray-500 hover:text-gray-700">
                    <Bell size={20} />
                </button>
                <div className="flex items-center gap-2">
                    <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white"
                        style={{ backgroundColor: theme.primary }}
                    >
                        <User size={16} />
                    </div>
                    <span className="text-sm font-medium text-gray-700">{user.name}</span>
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
