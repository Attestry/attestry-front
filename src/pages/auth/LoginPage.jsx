import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import useAuthStore from '../../store/useAuthStore';
import { ChevronRight, Lock, Mail } from 'lucide-react';
import TraceraLogo from '../../components/layout/TraceraLogo';
import { consumeAuthNotice } from '../../utils/authSession';

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [notice] = useState(() => consumeAuthNotice());
    const { login, error } = useAuthStore();
    const navigate = useNavigate();
    const location = useLocation();
    const returnTo = new URLSearchParams(location.search).get('returnTo');
    const safeReturnTo = returnTo && returnTo.startsWith('/') ? returnTo : null;
    const signupHref = safeReturnTo ? `/signup?returnTo=${encodeURIComponent(safeReturnTo)}` : '/signup';

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const result = await login(email, password);
            if (result.success) {
                if (safeReturnTo) {
                    navigate(safeReturnTo, { replace: true });
                    return;
                }
                if (result.user.role === 'PLATFORM_ADMIN') navigate('/admin/onboarding');
                else if (['BRAND', 'RETAIL', 'SERVICE'].includes(result.user.role)) navigate(`/${result.user.role.toLowerCase()}`);
                else navigate('/');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleAutoFill = (type) => {
        if (type === 'admin') {
            setEmail('platform.admin@attestry.local');
            setPassword('PlatformAdm1n!2026');
        } else {
            setEmail('test-curl@example.com');
            setPassword('Password123!');
        }
    }

    return (
        <div className="animate-in fade-in duration-500">
            <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#fbfaf7_0%,#f5f1e8_36%,#eef2f7_100%)] px-4 py-10 sm:px-6 lg:px-8">
                <div className="absolute left-[-10rem] top-12 h-[24rem] w-[24rem] rounded-full bg-[rgba(8,145,178,0.08)] blur-3xl" />
                <div className="absolute right-[-8rem] top-20 h-[22rem] w-[22rem] rounded-full bg-[rgba(15,23,42,0.08)] blur-3xl" />

                <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,1fr)_30rem]">
                    <section className="hidden lg:block">
                        <div className="max-w-2xl">
                            <TraceraLogo to="/" />
                            <h1 className="mt-10 text-5xl font-semibold tracking-[-0.07em] text-slate-950">
                                제품의 흐름을
                                <span className="block text-slate-600">신뢰 가능한 서비스 경험으로</span>
                            </h1>
                            <p className="mt-6 max-w-xl text-base leading-8 text-slate-600">
                                Tracera는 제품의 생애주기, 소유권, 서비스 이력, 지속가능성 데이터를 하나의 흐름으로 연결합니다.
                            </p>
                            <div className="mt-10 grid gap-4">
                                <div className="tracera-panel-soft px-5 py-4">
                                    <div className="text-sm font-semibold text-slate-950">정돈된 제품 이력</div>
                                    <p className="mt-2 text-sm leading-7 text-slate-600">출시부터 유통, 보유, 서비스, 재활용까지 한 문맥으로 관리합니다.</p>
                                </div>
                                <div className="tracera-panel-soft px-5 py-4">
                                    <div className="text-sm font-semibold text-slate-950">운영자와 최종 소유자 모두를 위한 구조</div>
                                    <p className="mt-2 text-sm leading-7 text-slate-600">브랜드, 리테일, 서비스 화면이 같은 서비스 인상 안에서 연결됩니다.</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="tracera-shell rounded-[2rem] px-5 py-8 sm:px-8">
                        <div className="mb-8 flex justify-center lg:hidden">
                            <TraceraLogo to="/" />
                        </div>
                        <div className="text-center lg:text-left">
                            <div className="text-sm font-semibold tracking-[0.18em] text-slate-500">로그인</div>
                            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950">시스템 로그인</h2>
                            <p className="mt-3 text-sm leading-7 text-slate-600">
                                계정이 없으신가요? <Link to={signupHref} className="font-semibold text-slate-950 underline-offset-4 hover:underline">회원가입 하기</Link>
                            </p>
                        </div>

                    <form className="mt-8 space-y-5" onSubmit={handleLogin}>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">이메일 주소</label>
                            <div className="mt-2 relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-slate-400" />
                                </div>
                                <input
                                    type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                                    className="tracera-input"
                                    placeholder="name@company.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700">비밀번호</label>
                            <div className="mt-2 relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-slate-400" />
                                </div>
                                <input
                                    type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                                    className="tracera-input"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        {(notice || error) && (
                            <div className="rounded-[1.1rem] border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-600">
                                {notice || error}
                            </div>
                        )}

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="tracera-button-primary w-full"
                            >
                                {loading ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                        로그인 중...
                                    </div> 
                                ) : '로그인'}
                            </button>
                        </div>
                    </form>

                    <div className="mt-8">
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-slate-200" />
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="bg-[var(--color-page)] px-3 text-slate-400 lg:bg-transparent">빠른 테스트 계정</span>
                            </div>
                        </div>

                        <div className="mt-6 grid grid-cols-1 gap-3">
                            <button
                                onClick={() => handleAutoFill('admin')}
                                className="tracera-button-secondary w-full"
                            >
                                플랫폼 관리자
                            </button>
                        </div>
                    </div>

                        <Link to="/" className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900">
                            홈페이지로 돌아가기
                            <ChevronRight size={15} />
                        </Link>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
