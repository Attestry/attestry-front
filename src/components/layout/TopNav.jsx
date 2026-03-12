import React from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/useAuthStore';
import { getRoleLandingPath } from '../../utils/roleNavigation';
import TraceraLogo from './TraceraLogo';
import AccountMenu from './AccountMenu';

const TopNav = () => {
    const { user } = useAuthStore();
    const navigate = useNavigate();

    if (!user) return null;

    const homePath = getRoleLandingPath(user.role);

    return (
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-white/70 bg-[rgba(247,246,242,0.82)] px-4 backdrop-blur-xl sm:px-6">
            <div className="flex items-center gap-4">
                <TraceraLogo to={homePath} compact subtitle={false} />
            </div>

            <div className="flex items-center gap-4">
                <AccountMenu user={user} navigate={navigate} />
            </div>
        </header>
    );
};

export default TopNav;
