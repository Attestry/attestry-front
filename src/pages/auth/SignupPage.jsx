import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import useAuthStore from '../../store/useAuthStore';
import { Lock, Mail, Phone } from 'lucide-react';

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
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 animate-in fade-in duration-500">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <Link to="/" className="flex justify-center items-center gap-2 font-bold text-2xl text-gray-900 mb-6">
                    <div className="bg-gray-900 text-white w-10 h-10 rounded-lg flex items-center justify-center font-bold">D</div>
                    DPP Ledger
                </Link>
                <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">회원가입</h2>
                <p className="mt-2 text-center text-sm text-gray-600">
                    이미 계정이 있으신가요? <Link to={loginHref} className="font-medium text-blue-600 hover:text-blue-500">로그인 하기</Link>
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-200">
                    <form className="space-y-5" onSubmit={handleSignup}>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">이메일 주소</label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 border outline-none"
                                    placeholder="name@company.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">비밀번호</label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="password" required value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 border outline-none"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">전화번호</label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Phone className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="text" required value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 border outline-none"
                                    placeholder="010-0000-0000"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="text-red-600 text-sm font-medium text-center bg-red-50 p-2 rounded">
                                {error}
                            </div>
                        )}

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={loading}
                                className={`w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
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
                </div>
            </div>
        </div>
    );
};

export default SignupPage;
