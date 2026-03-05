import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, Link } from 'react-router-dom';
import useAuthStore from '../../store/useAuthStore';

const InvitationAccept = () => {
    const { invitationId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { isAuthenticated, accessToken, acceptInvitation, fetchMyMemberships, logout } = useAuthStore();

    const [status, setStatus] = useState('idle');
    const [error, setError] = useState(null);

    const returnTo = useMemo(() => {
        const params = new URLSearchParams(location.search);
        const value = params.get('returnTo');
        if (!value) return null;
        return value.startsWith('/') ? value : null;
    }, [location.search]);

    const selfUrl = useMemo(() => location.pathname + location.search, [location.pathname, location.search]);

    useEffect(() => {
        const run = async () => {
            if (!isAuthenticated) {
                navigate(`/login?returnTo=${encodeURIComponent(selfUrl)}`, { replace: true });
                return;
            }
            if (!accessToken) return;
            if (!invitationId) {
                setStatus('error');
                setError('초대 정보가 올바르지 않습니다.');
                return;
            }

            setStatus('loading');
            const result = await acceptInvitation(invitationId);
            if (!result.success) {
                const message = (result.message || '').toLowerCase();
                if (message.includes('authentication') || message.includes('unauthorized')) {
                    logout();
                    return;
                }
                setStatus('error');
                setError(result.message || '초대 수락에 실패했습니다.');
                return;
            }

            await fetchMyMemberships();
            setStatus('success');
            navigate('/dashboard', { replace: true });
        };

        run();
    }, [isAuthenticated, accessToken, invitationId, acceptInvitation, fetchMyMemberships, navigate, logout, selfUrl]);

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8 max-w-md w-full text-center">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">초대 수락</h1>
                    <p className="text-gray-600 mb-6">
                        로그인 화면으로 이동합니다...
                    </p>
                    <div className="flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8 max-w-md w-full text-center">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">초대 수락 처리 중</h1>
                {status === 'loading' && (
                    <div className="flex flex-col items-center gap-3 text-gray-500">
                        <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                        처리 중입니다...
                    </div>
                )}
                {status === 'error' && (
                    <div className="text-red-600 text-sm font-medium bg-red-50 p-3 rounded">
                        {error}
                    </div>
                )}
                {status === 'success' && (
                    <div className="text-green-600 text-sm font-medium bg-green-50 p-3 rounded">
                        초대가 수락되었습니다. 대시보드로 이동합니다.
                    </div>
                )}
                {returnTo && (
                    <div className="mt-4 text-xs text-gray-400">이동 경로: {returnTo}</div>
                )}
            </div>
        </div>
    );
};

export default InvitationAccept;
