import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import useAuthStore from '../../store/useAuthStore';
import { ChevronRight, Lock, Mail, Phone, ShieldCheck } from 'lucide-react';
import TraceraLogo from '../../components/layout/TraceraLogo';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[A-Z]).{8,}$/;
const PHONE_REGEX = /^010-\d{4}-\d{4}$/;
const CODE_REGEX = /^\d{8}$/;

const SignupPage = () => {
    const [formData, setFormData] = useState({ email: '', password: '', phone: '', code: '' });
    const [loading, setLoading] = useState(false);
    const [verificationLoading, setVerificationLoading] = useState(false);
    const [confirmLoading, setConfirmLoading] = useState(false);
    const [localError, setLocalError] = useState(null);
    const [verificationNotice, setVerificationNotice] = useState('');
    const [verificationError, setVerificationError] = useState('');
    const [verificationMeta, setVerificationMeta] = useState(null);
    const [emailVerified, setEmailVerified] = useState(false);
    const [now, setNow] = useState(Date.now());
    const { signup, requestSignupEmailVerification, confirmSignupEmailVerification, error: storeError } = useAuthStore();
    const navigate = useNavigate();
    const location = useLocation();
    const returnTo = new URLSearchParams(location.search).get('returnTo');
    const safeReturnTo = returnTo && returnTo.startsWith('/') ? returnTo : null;
    const loginHref = safeReturnTo ? `/login?returnTo=${encodeURIComponent(safeReturnTo)}` : '/login';

    const error = localError || storeError;

    useEffect(() => {
        if (!verificationMeta?.expiresAt || emailVerified) return undefined;
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, [verificationMeta?.expiresAt, emailVerified]);

    const emailValid = EMAIL_REGEX.test(formData.email.trim());
    const passwordValid = PASSWORD_REGEX.test(formData.password);
    const phoneValid = PHONE_REGEX.test(formData.phone.trim());
    const codeValid = CODE_REGEX.test(formData.code.trim());

    const expiresAtMs = verificationMeta?.expiresAt ? new Date(verificationMeta.expiresAt).getTime() : null;
    const cooldownMs = verificationMeta?.lastRequestedAt ? new Date(verificationMeta.lastRequestedAt).getTime() + 10_000 - now : null;
    const expiresRemainingMs = expiresAtMs ? expiresAtMs - now : null;
    const resendCount = verificationMeta?.resendCount ?? 0;
    const resendLimit = verificationMeta?.resendLimit ?? 3;
    const resendRemaining = Math.max(0, resendLimit - resendCount);
    const cooldownRemaining = cooldownMs ? Math.max(0, Math.ceil(cooldownMs / 1000)) : 0;
    const codeExpired = !!verificationMeta && !emailVerified && expiresRemainingMs !== null && expiresRemainingMs <= 0;

    const fieldErrors = useMemo(() => ({
        email: formData.email && !emailValid ? '올바른 이메일 형식을 입력해주세요.' : '',
        password: formData.password && !passwordValid ? '비밀번호는 8자 이상이며 영문 대문자를 1자 이상 포함해야 합니다.' : '',
        phone: formData.phone && !phoneValid ? '전화번호는 010-0000-0000 형식으로 입력해주세요.' : '',
        code: formData.code && !codeValid ? '인증코드는 8자리 숫자입니다.' : '',
    }), [codeValid, emailValid, formData.code, formData.email, formData.password, formData.phone, passwordValid, phoneValid]);

    const resetVerificationState = (nextEmail = '') => {
        setVerificationMeta(null);
        setEmailVerified(false);
        setVerificationError('');
        setVerificationNotice('');
        setFormData((prev) => ({ ...prev, email: nextEmail, code: '' }));
    };

    const handleFieldChange = (field, value) => {
        setLocalError(null);
        if (field === 'email') {
            resetVerificationState(value);
            return;
        }
        if (field === 'code') {
            setVerificationError('');
        }
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const requestVerification = async () => {
        setVerificationError('');
        setVerificationNotice('');
        setLocalError(null);

        if (!emailValid) {
            setVerificationError('올바른 이메일 형식을 먼저 입력해주세요.');
            return;
        }
        if (emailVerified) {
            setVerificationNotice('이메일 인증이 이미 완료되었습니다.');
            return;
        }
        if (cooldownRemaining > 0) {
            setVerificationError(`${cooldownRemaining}초 후에 다시 요청할 수 있습니다.`);
            return;
        }
        if (verificationMeta && resendRemaining <= 0) {
            setVerificationError('재전송 가능 횟수를 모두 사용했습니다.');
            return;
        }

        setVerificationLoading(true);
        try {
            const result = await requestSignupEmailVerification(formData.email.trim());
            if (!result.success) {
                setVerificationError(result.message || '인증코드 발송에 실패했습니다.');
                return;
            }

            const data = result.data || {};
            setVerificationMeta({
                ...data,
                lastRequestedAt: new Date().toISOString(),
            });
            setVerificationNotice(verificationMeta ? '인증코드를 다시 발송했습니다.' : '인증코드를 이메일로 발송했습니다.');
            setFormData((prev) => ({ ...prev, email: data.email || prev.email, code: '' }));
        } finally {
            setVerificationLoading(false);
        }
    };

    const confirmVerification = async () => {
        setVerificationError('');
        setVerificationNotice('');
        setLocalError(null);

        if (!verificationMeta) {
            setVerificationError('먼저 인증코드를 발송해주세요.');
            return;
        }
        if (codeExpired) {
            setVerificationError('인증코드 유효시간이 만료되었습니다. 다시 발송해주세요.');
            return;
        }
        if (!codeValid) {
            setVerificationError('인증코드 8자리를 정확히 입력해주세요.');
            return;
        }

        setConfirmLoading(true);
        try {
            const result = await confirmSignupEmailVerification(formData.email.trim(), formData.code.trim());
            if (!result.success) {
                setVerificationError(result.message || '이메일 인증에 실패했습니다.');
                return;
            }

            const data = result.data || {};
            setVerificationMeta((prev) => ({
                ...(prev || {}),
                ...data,
                lastRequestedAt: prev?.lastRequestedAt || new Date().toISOString(),
            }));
            setEmailVerified(true);
            setVerificationNotice('이메일 인증이 완료되었습니다.');
        } finally {
            setConfirmLoading(false);
        }
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        setLoading(true);
        setLocalError(null);
        setVerificationError('');
        try {
            if (!emailVerified) {
                setLocalError('이메일 인증을 완료한 뒤 회원가입을 진행해주세요.');
                return;
            }

            const result = await signup(formData.email.trim(), formData.password, formData.phone.trim());
            if (result.success) {
                alert('회원가입이 완료되었습니다. 로그인해주세요.');
                const next = safeReturnTo ? `/login?returnTo=${encodeURIComponent(safeReturnTo)}` : '/login';
                navigate(next);
            } else {
                setLocalError(result.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const submitDisabled = loading || !emailValid || !passwordValid || !phoneValid || !emailVerified;
    const codeStatusText = emailVerified
        ? '이메일 인증이 완료되었습니다.'
        : codeExpired
            ? '인증코드가 만료되었습니다. 다시 발송해주세요.'
            : verificationMeta?.expiresAt
                ? `남은 인증 시간 ${Math.max(0, Math.floor((expiresRemainingMs || 0) / 1000 / 60)).toString().padStart(2, '0')}:${Math.max(0, Math.floor((expiresRemainingMs || 0) / 1000) % 60).toString().padStart(2, '0')}`
                : '이메일 인증 후 회원가입을 진행할 수 있습니다.';

    return (
        <div className="animate-in fade-in duration-500">
            <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#fbfaf7_0%,#f5f1e8_36%,#eef2f7_100%)] px-4 py-10 sm:px-6 lg:px-8">
                <div className="absolute left-[-10rem] top-14 h-[24rem] w-[24rem] rounded-full bg-[rgba(8,145,178,0.08)] blur-3xl" />
                <div className="absolute right-[-8rem] top-20 h-[22rem] w-[22rem] rounded-full bg-[rgba(15,23,42,0.08)] blur-3xl" />

                <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,1fr)_32rem]">
                    <section className="hidden lg:block">
                        <div className="max-w-2xl">
                            <TraceraLogo to="/" />
                            <div className="tracera-page-tag mt-10">SIGN UP EXPERIENCE</div>
                            <h1 className="mt-6 text-5xl font-semibold tracking-[-0.07em] text-slate-950">
                                제품의 이력과 소유권을
                                <span className="block text-slate-600">더 분명하고 신뢰 있게 이어갑니다</span>
                            </h1>
                            <p className="mt-6 max-w-xl text-base leading-8 text-slate-600">
                                Proveny는 제품 등록부터 소유권 이전, 서비스 이력까지 하나의 흐름으로 연결해 더 명확한 제품 경험을 만듭니다.
                            </p>
                            <div className="mt-10 grid gap-4">
                                <div className="tracera-panel-soft px-5 py-4">
                                    <div className="text-sm font-semibold text-slate-950">이메일 인증 기반 가입</div>
                                    <p className="mt-2 text-sm leading-7 text-slate-600">가입 전에 이메일 소유를 먼저 확인해 잘못된 계정 생성과 오입력을 줄입니다.</p>
                                </div>
                                <div className="tracera-panel-soft px-5 py-4">
                                    <div className="text-sm font-semibold text-slate-950">더 분명한 계정 보안</div>
                                    <p className="mt-2 text-sm leading-7 text-slate-600">비밀번호와 연락처 형식을 바로 확인하고, 인증이 끝난 이메일만 회원가입에 사용할 수 있습니다.</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="tracera-shell rounded-[2rem] px-5 py-8 sm:px-8">
                        <div className="mb-8 flex justify-center lg:hidden">
                            <TraceraLogo to="/" />
                        </div>
                        <div className="text-center lg:text-left">
                            <div className="tracera-page-pill">회원가입</div>
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
                                        type="email"
                                        required
                                        value={formData.email}
                                        onChange={(e) => handleFieldChange('email', e.target.value)}
                                        className="tracera-input"
                                        placeholder="name@company.com"
                                        disabled={emailVerified}
                                    />
                                </div>
                                {fieldErrors.email && <p className="mt-2 text-sm text-red-600">{fieldErrors.email}</p>}
                            </div>

                            <div className="rounded-[1.35rem] border border-slate-200 bg-[linear-gradient(140deg,#ffffff,#f8fbff)] p-4 sm:p-5">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="space-y-1">
                                        <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                                            <ShieldCheck size={16} className="text-slate-500" />
                                            이메일 인증
                                        </div>
                                        <p className="text-sm leading-6 text-slate-600">{codeStatusText}</p>
                                        {verificationMeta && !emailVerified && (
                                            <p className="text-xs text-slate-500">재전송 가능 횟수 {resendRemaining}회 / 쿨다운 {cooldownRemaining}초</p>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={requestVerification}
                                        disabled={verificationLoading || !emailValid || emailVerified || (verificationMeta && resendRemaining <= 0) || cooldownRemaining > 0}
                                        className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {verificationLoading ? '발송 중...' : verificationMeta ? '인증코드 재발송' : '인증코드 받기'}
                                    </button>
                                </div>

                                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                                    <div className="flex-1">
                                        <input
                                            type="text"
                                            value={formData.code}
                                            onChange={(e) => handleFieldChange('code', e.target.value.replace(/\D/g, '').slice(0, 8))}
                                            placeholder="8자리 인증코드"
                                            className="tracera-input !mt-0"
                                            disabled={!verificationMeta || emailVerified}
                                        />
                                        {fieldErrors.code && <p className="mt-2 text-sm text-red-600">{fieldErrors.code}</p>}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={confirmVerification}
                                        disabled={confirmLoading || !verificationMeta || emailVerified || !codeValid || codeExpired}
                                        className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-[132px]"
                                    >
                                        {confirmLoading ? '확인 중...' : emailVerified ? '인증 완료' : '인증하기'}
                                    </button>
                                </div>

                                {verificationNotice && (
                                    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                                        {verificationNotice}
                                    </div>
                                )}
                                {verificationError && (
                                    <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                        {verificationError}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700">비밀번호</label>
                                <div className="mt-2 relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-slate-400" />
                                    </div>
                                    <input
                                        type="password"
                                        required
                                        value={formData.password}
                                        onChange={(e) => handleFieldChange('password', e.target.value)}
                                        className="tracera-input"
                                        placeholder="대문자 포함 8자 이상"
                                    />
                                </div>
                                {fieldErrors.password
                                    ? <p className="mt-2 text-sm text-red-600">{fieldErrors.password}</p>
                                    : <p className="mt-2 text-sm text-slate-500">비밀번호는 8자 이상이며 영문 대문자를 1자 이상 포함해야 합니다.</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700">전화번호</label>
                                <div className="mt-2 relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Phone className="h-5 w-5 text-slate-400" />
                                    </div>
                                    <input
                                        type="text"
                                        required
                                        value={formData.phone}
                                        onChange={(e) => handleFieldChange('phone', e.target.value)}
                                        className="tracera-input"
                                        placeholder="010-0000-0000"
                                    />
                                </div>
                                {fieldErrors.phone && <p className="mt-2 text-sm text-red-600">{fieldErrors.phone}</p>}
                            </div>

                            {error && (
                                <div className="rounded-[1.1rem] border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-600">
                                    {error}
                                </div>
                            )}

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={submitDisabled}
                                    className="tracera-button-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {loading ? (
                                        <div className="flex items-center gap-2">
                                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                            처리 중...
                                        </div>
                                    ) : '회원가입 완료'}
                                </button>
                                {!emailVerified && (
                                    <p className="mt-3 text-center text-sm text-slate-500">이메일 인증을 완료해야 회원가입을 진행할 수 있습니다.</p>
                                )}
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
