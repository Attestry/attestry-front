import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import TopNav from './TopNav';
import Sidebar from './Sidebar';
import useAuthStore from '../../store/useAuthStore';

const DashboardLayout = () => {
    const { isAuthenticated, user } = useAuthStore();

    // Prevent rendering TopNav and Sidebar if there is no user session
    if (!isAuthenticated || !user) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="min-h-screen bg-[#f7f7f5]">
            <TopNav />
            <div className="flex flex-col lg:flex-row">
                <Sidebar />
                <main className="flex-1 bg-[#f7f7f5] p-4 sm:p-6 md:p-8 overflow-y-auto lg:h-[calc(100vh-4rem)]">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default DashboardLayout;
