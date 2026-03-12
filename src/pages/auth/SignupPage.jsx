import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import useAuthStore from '../../store/useAuthStore';
import { ChevronRight, Lock, Mail, Phone } from 'lucide-react';
import TraceraLogo from '../../components/layout/TraceraLogo';

const SignupPage = () => {
    const [formData, setFormData] = useState({ email: '', password: '', phone: '' });
    const [loading, setLoading] = useState(false);
    const [localError, setLocalError] = useState(null);
    const { signup, error: storeError } = useAuthStore();
    const navigate = useNavigate();
    const location = useLocation();
    const returnTo = new URLSearchParams(location.search).get('returnTo');
    const safeReturnTo = returnTo && returnTo.startsWith('/') ? returnTo : null;
    const loginHref = safeReturnTo ? `/login?returnTo=${encodeURIComponent(safeReturnTo)}` : '/login';

    const error = localError || storeError;

    const handleSignup = async (e) => {
        e.preventDefault();
        setLoading(true);
        setLocalError(null);
        try {
            const result = await signup(formData.email, formData.password, formData.phone);
            if (result.success) {
                alert('회원가입이 완료되었습니다. 로그인해주세요.');
                // Preserve returnTo when going to login
                const next = safeReturnTo ? `/login?returnTo=${encodeURIComponent(safeReturnTo)}` : '/login';
                navigate(next);
            } else {
                setLocalError(result.message);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="animate-in fade-in duration-500">
            <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#fbfaf7_0%,#f5f1e8_36%,#eef2f7_100%)] px-4 py-10 sm:px-6 lg:px-8">
                <div className="absolute left-[-10rem] top-14 h-[24rem] w-[24rem] rounded-full bg-[rgba(8,145,178,0.08)] blur-3xl" />
                <div className="absolute right-[-8rem] top-20 h-[22rem] w-[22rem] rounded-full bg-[rgba(15,23,42,0.08)] blur-3xl" />

                <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,1fr)_30rem]">
                    <section className="hidden lg:block">
                        <div className="max-w-2xl">
                            <TraceraLogo to="/" />
                            <h1 className="mt-10 text-5xl font-semibold tracking-[-0.07em] text-slate-950">
                                브랜드와 사용자,
                                <span className="block text-slate-600">그 사이의 제품 경험을 연결합니다</span>
                            </h1>
                            <p className="mt-6 max-w-xl text-base leading-8 text-slate-600">
                                Tracera는 제품의 이력을 더 신뢰 가능하게 정리하고, 이후 서비스와 지속가능성 데이터까지 이어지게 만듭니다.
                            </p>
                            <div className="mt-10 grid gap-4">
                                <div className="tracera-panel-soft px-5 py-4">
                                    <div className="text-sm font-semibold text-slate-950">더 정확한 소유권 경험</div>
                                    <p className="mt-2 text-sm leading-7 text-slate-600">사용자는 정리된 제품 이력을, 운영자는 일관된 관리 흐름을 경험합니다.</p>
                                </div>
                                <div className="tracera-panel-soft px-5 py-4">
                                    <div className="text-sm font-semibold text-slate-950">서비스 이후까지 이어지는 구조</div>
                                    <p className="mt-2 text-sm leading-7 text-slate-600">수리와 점검, 공지와 순환 이력까지 끊기지 않도록 설계합니다.</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="tracera-shell rounded-[2rem] px-5 py-8 sm:px-8">
                        <div className="mb-8 flex justify-center lg:hidden">
                            <TraceraLogo to="/" />
                        </div>
                        <div className="text-center lg:text-left">
                            <div className="text-sm font-semibold tracking-[0.18em] text-slate-500">회원가입</div>
                            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950">회원가입</h2>
                            <p className="mt-3 text-sm leading-7 text-slate-600">
                                이미 계정이 있으신가요? <Link to={loginHref} className="font-semibold text-slate-950 underline-offset-4 hover:underline">로그인 하기</Link>
                            </p>
                        </div>

                    <form className="mt-8 space-y-5" onSubmit={handleSignup}>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">이메일 주소</label>
                            <div className="mt-2 relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-slate-400" />
                                </div>
                                <input
                                    type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
                                    type="password" required value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className="tracera-input"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700">전화번호</label>
                            <div className="mt-2 relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Phone className="h-5 w-5 text-slate-400" />
                                </div>
                                <input
                                    type="text" required value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    className="tracera-input"
                                    placeholder="010-0000-0000"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="rounded-[1.1rem] border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-600">
                                {error}
                            </div>
                        )}

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={loading}
                                className="tracera-button-primary w-full"
                            >
                                {loading ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                        처리 중...
                                    </div>
                                ) : '회원가입 완료'}
                            </button>
                        </div>
                    </form>

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

export default SignupPage;
