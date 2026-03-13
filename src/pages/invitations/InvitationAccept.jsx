import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useLocation, useNavigate, useParams, Link } from 'react-router-dom';
import useAuthStore from '../../store/useAuthStore';
import { Mail, CheckCircle, AlertCircle, Loader2, ArrowRight } from 'lucide-react';

const InvitationAccept = () => {
    const { invitationId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { isAuthenticated, accessToken, acceptInvitation, fetchMyMemberships, logout } = useAuthStore();

    const [status, setStatus] = useState('idle'); // idle, loading, success, error
    const [error, setError] = useState(null);
    const hasFetched = useRef(false);

    const selfUrl = useMemo(() => location.pathname + location.search, [location.pathname, location.search]);

    useEffect(() => {
        const run = async () => {
            // 1. Check Auth - Redirect if needed
            if (!isAuthenticated) {
                navigate(`/login?returnTo=${encodeURIComponent(selfUrl)}`, { replace: true });
                return;
            }

            if (!accessToken) return;

            // 2. Validate URL
            if (!invitationId) {
                setStatus('error');
                setError('초대 정보가 올바르지 않습니다.');
                return;
            }

            // 3. Avoid double call
            if (hasFetched.current) return;
            hasFetched.current = true;

            // 4. Accept Invitation
            setStatus('loading');
            try {
                const result = await acceptInvitation(invitationId);

                if (!result.success) {
                    const message = (result.message || '').toLowerCase();
                    // If token is invalid/expired during this process, logout and re-auth
                    if (message.includes('authentication') || message.includes('unauthorized') || message.includes('token')) {
                        logout();
                        return;
                    }
                    setStatus('error');
                    setError(result.message || '초대 수락에 실패했습니다.');
                    return;
                }

                // 5. Success - Sync memberships only. If backend invalidates the token later,
                // the global auth handler will redirect on the next protected call.
                await fetchMyMemberships();

                setStatus('success');

                // Show success for 1.5s then go to dashboard
                setTimeout(() => {
                    navigate('/dashboard', { replace: true });
                }, 1500);

            } catch (err) {
                setStatus('error');
                setError('통신 중 오류가 발생했습니다.');
            }
        };

        run();
    }, [isAuthenticated, accessToken, invitationId, acceptInvitation, fetchMyMemberships, navigate, logout, selfUrl]);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 sm:p-12">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden transform transition-all">
                <div className="p-8 sm:p-10 text-center">

                    {/* Header Icon */}
                    <div className="flex justify-center mb-6">
                        {status === 'loading' && (
                            <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center animate-pulse">
                                <Loader2 size={40} className="animate-spin" />
                            </div>
                        )}
                        {status === 'success' && (
                            <div className="w-20 h-20 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center animate-in zoom-in duration-300">
                                <CheckCircle size={40} />
                            </div>
                        )}
                        {status === 'error' && (
                            <div className="w-20 h-20 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center animate-in shake duration-300">
                                <AlertCircle size={40} />
                            </div>
                        )}
                        {status === 'idle' && !isAuthenticated && (
                            <div className="w-20 h-20 bg-gray-50 text-gray-400 rounded-2xl flex items-center justify-center">
                                <Mail size={40} />
                            </div>
                        )}
                    </div>

                    <h1 className="text-2xl font-bold text-gray-900 mb-3">초대 수락</h1>

                    <div className="min-h-[60px] flex items-center justify-center mb-8 px-4">
                        {status === 'loading' && (
                            <p className="text-gray-500">초대 정보를 확인하고 권한을 설정하고 있습니다...</p>
                        )}
                        {status === 'success' && (
                            <div className="text-green-600 font-medium">
                                초대가 성공적으로 수락되었습니다!<br />
                                <span className="text-sm text-gray-400 font-normal">잠시 후 대시보드로 이동합니다.</span>
                            </div>
                        )}
                        {status === 'error' && (
                            <div className="space-y-4 w-full">
                                <p className="text-red-500 bg-red-50 py-3 px-4 rounded-xl text-sm border border-red-100">
                                    {error}
                                </p>
                                <Link to="/" className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-semibold transition-colors">
                                    홈으로 돌아가기 <ArrowRight size={16} />
                                </Link>
                            </div>
                        )}
                        {status === 'idle' && !isAuthenticated && (
                            <p className="text-gray-500">로그인 후에 초대를 수락할 수 있습니다.</p>
                        )}
                    </div>

                    {/* Footer Progress bar (Loading only) */}
                    {status === 'loading' && (
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-600 animate-progress origin-left rounded-full" />
                        </div>
                    )}
                </div>
            </div>

            <p className="mt-8 text-gray-400 text-sm">
                Attestry DPP Ledger &copy; 2026
            </p>
        </div>
    );
};

export default InvitationAccept;
