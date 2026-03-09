import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode, Search, ChevronRight, X, ShieldCheck, ClipboardList, Loader2, ArrowRight } from 'lucide-react';
import useAuthStore from '../../store/useAuthStore';
import ModernScanner from '../../components/common/ModernScanner';

const apiFetch = async (url, options = {}) => {
    const token = useAuthStore.getState().accessToken;
    const headers = {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
        let errorMsg = 'API Error';
        try {
            const errorData = await response.json();
            errorMsg = errorData.message || errorMsg;
        } catch (e) { }
        throw new Error(errorMsg);
    }
    if (response.status === 204) return null;
    return response.json();
};

const ServiceApplication = () => {
    const { user, myMemberships } = useAuthStore();
    const navigate = useNavigate();

    const [step, setStep] = useState(1); // 1: Provider Selection, 2: Scan, 3: Complete
    const [isQRScannerModalOpen, setIsQRScannerModalOpen] = useState(false);
    const [scannedPassportId, setScannedPassportId] = useState(null);

    const [providers, setProviders] = useState([]);
    const [providerLoading, setProviderLoading] = useState(false);
    const [providerSearchTerm, setProviderSearchTerm] = useState('');
    const [selectedProvider, setSelectedProvider] = useState(null);
    const [consentLoading, setConsentLoading] = useState(false);

    // Pagination state
    const [page, setPage] = useState(0);
    const [pageSize] = useState(20);
    const [hasMore, setHasMore] = useState(true);
    const searchTimeoutRef = useRef(null);

    const currentMembership = user?.tenantId
        ? (myMemberships || []).find((m) =>
            m?.tenantId === user.tenantId &&
            String(m?.status || '').toUpperCase() === 'ACTIVE'
        )
        : null;

    useEffect(() => {
        fetchProviders(0, '', true);
    }, []);

    const playScannerSuccessFeedback = useCallback(() => {
        try {
            if (navigator.vibrate) {
                navigator.vibrate([90, 40, 120]);
            }
        } catch (e) { }

        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const now = ctx.currentTime;

            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(880, now);
            gain1.gain.setValueAtTime(0.0001, now);
            gain1.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
            gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
            osc1.connect(gain1).connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.13);

            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(1175, now + 0.1);
            gain2.gain.setValueAtTime(0.0001, now + 0.1);
            gain2.gain.exponentialRampToValueAtTime(0.1, now + 0.12);
            gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
            osc2.connect(gain2).connect(ctx.destination);
            osc2.start(now + 0.1);
            osc2.stop(now + 0.21);

            setTimeout(() => {
                ctx.close().catch(() => { });
            }, 350);
        } catch (e) { }
    }, []);

    const fetchProviders = async (pageNum, keyword = '', reset = false) => {
        if (reset) {
            setProviders([]);
            setPage(0);
        }

        setProviderLoading(true);
        try {
            const nameParam = keyword ? `&name=${encodeURIComponent(keyword)}` : '';
            const data = await apiFetch(`/workflows/service/providers?page=${pageNum}&size=${pageSize}${nameParam}`);

            // Handle both Page object and direct array response
            const results = Array.isArray(data) ? data : (data?.content || []);

            if (reset) {
                setProviders(results);
            } else {
                setProviders(prev => [...prev, ...results]);
            }

            setHasMore(results.length === pageSize);
            setPage(pageNum);
        } catch (error) {
            console.error("Failed to fetch service providers:", error);
        } finally {
            setProviderLoading(false);
        }
    };

    const handleSearchChange = (e) => {
        const val = e.target.value;
        setProviderSearchTerm(val);

        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

        searchTimeoutRef.current = setTimeout(() => {
            fetchProviders(0, val, true);
        }, 300);
    };

    const loadMore = () => {
        if (!providerLoading && hasMore) {
            fetchProviders(page + 1, providerSearchTerm, false);
        }
    };

    const handleSelectProvider = (provider) => {
        setSelectedProvider(provider);
        setStep(2);
    };

    const parsePassportIdFromScan = (rawValue) => {
        const value = String(rawValue || '').trim();
        if (!value) return null;

        try {
            const url = new URL(value);
            // Case 1: Standard URL path /products/passports/{passportId}
            const pathParts = url.pathname.split('/').filter(Boolean);
            const passportIndex = pathParts.indexOf('passports');
            if (passportIndex !== -1 && pathParts[passportIndex + 1]) {
                return pathParts[passportIndex + 1];
            }

            // Case 2: Query parameter passportId=...
            const qParam = url.searchParams.get('passportId');
            if (qParam) return qParam;
        } catch {
            // non-URL
        }

        // Case 3: JSON payload
        try {
            const parsed = JSON.parse(value);
            if (parsed.passportId) return parsed.passportId;
        } catch {
            // non-JSON
        }

        // Case 4: Raw value (UUID style or alphanumeric)
        return value;
    };

    const handleQRScanSuccess = async (decodedText) => {
        const passportId = parsePassportIdFromScan(decodedText);

        if (!passportId) {
            alert("QR 코드에서 올바른 정보를 추출할 수 없습니다.");
            return;
        }

        setIsQRScannerModalOpen(false);
        playScannerSuccessFeedback();
        setScannedPassportId(passportId);

        // Trigger consent automatically after scan
        await triggerConsent(passportId, selectedProvider);
    };

    const triggerConsent = async (passportId, provider) => {
        if (!passportId || !provider?.tenantId) {
            alert("서비스 신청을 위한 정보가 부족합니다.");
            return;
        }

        setConsentLoading(true);
        try {
            await apiFetch(`/workflows/passports/${passportId}/service-consent`, {
                method: 'POST',
                body: JSON.stringify({
                    providerTenantId: provider.tenantId
                })
            });

            setStep(3);
        } catch (error) {
            console.error("Failed to grant service consent:", error);
            alert(`신청 실패: ${error.message}`);
        } finally {
            setConsentLoading(false);
        }
    };

    return (
        <div className="min-h-[calc(100vh-64px)] bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto">
                {/* Progress Header */}
                <div className="mb-12">
                    <div className="flex items-center justify-between relative">
                        {[1, 2, 3].map((s) => (
                            <div key={s} className="flex flex-col items-center z-10">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${step >= s ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-gray-400 border border-gray-200'
                                    }`}>
                                    {s === 1 && <ShieldCheck size={18} />}
                                    {s === 2 && <QrCode size={18} />}
                                    {s === 3 && <ClipboardList size={18} />}
                                </div>
                                <span className={`text-[10px] mt-2 font-bold uppercase tracking-wider ${step >= s ? 'text-indigo-600' : 'text-gray-400'}`}>
                                    {s === 1 ? '업체 선택' : s === 2 ? 'QR 스캔' : '신청 완료'}
                                </span>
                            </div>
                        ))}
                        <div className="absolute top-5 left-0 w-full h-[2px] bg-gray-200 -z-0">
                            <div
                                className="h-full bg-indigo-600 transition-all duration-500"
                                style={{ width: `${((step - 1) / 2) * 100}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="bg-white rounded-3xl shadow-xl shadow-indigo-100/50 border border-gray-100 overflow-hidden min-h-[400px] flex flex-col">
                    {step === 1 && (
                        <div className="flex-1 flex flex-col animate-in fade-in duration-300">
                            <div className="p-6 border-b border-gray-100">
                                <h2 className="text-xl font-extrabold text-gray-900">서비스 업체 선택</h2>
                                <p className="text-sm text-gray-500 mt-1">이 제품의 서비스를 담당할 업체를 먼저 선택해 주세요.</p>

                                <div className="mt-6 relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input
                                        type="text"
                                        placeholder="서비스 업체명 검색..."
                                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-200 transition-all font-medium"
                                        value={providerSearchTerm}
                                        onChange={handleSearchChange}
                                    />
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-3 max-h-[400px]">
                                {providers.length === 0 && !providerLoading ? (
                                    <div className="text-center py-20">
                                        <p className="text-gray-400 font-medium">검색 결과가 없습니다.</p>
                                    </div>
                                ) : (
                                    <>
                                        {providers.map((p) => (
                                            <button
                                                key={p.tenantId}
                                                onClick={() => handleSelectProvider(p)}
                                                className="w-full text-left p-5 rounded-2xl border border-gray-100 hover:border-indigo-300 hover:bg-indigo-50 transition-all group flex justify-between items-center bg-white shadow-sm hover:shadow-md cursor-pointer"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                                                        <ShieldCheck size={24} />
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-gray-900 group-hover:text-indigo-700">
                                                            {p.name || p.tenantId}
                                                        </div>
                                                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                                                            <span className="font-mono">{p.tenantId}</span>
                                                            {p.region && (
                                                                <>
                                                                    <span className="w-1 h-1 rounded-full bg-gray-300" />
                                                                    <span>{p.region}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-300 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                                                    <ChevronRight size={18} />
                                                </div>
                                            </button>
                                        ))}

                                        {providerLoading && (
                                            <div className="flex justify-center py-4">
                                                <Loader2 size={24} className="animate-spin text-indigo-600" />
                                            </div>
                                        )}

                                        {!providerLoading && hasMore && (
                                            <button
                                                onClick={loadMore}
                                                className="w-full py-4 text-sm font-bold text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-colors"
                                            >
                                                더 보기
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="p-10 flex-1 flex flex-col items-center justify-center text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="mb-6 flex flex-col items-center">
                                <div className="px-4 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold mb-4 flex items-center gap-2">
                                    <ShieldCheck size={14} />
                                    선택한 업체: {selectedProvider?.name || selectedProvider?.tenantId}
                                </div>
                                <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center">
                                    <QrCode size={48} />
                                </div>
                            </div>
                            <h2 className="text-2xl font-extrabold text-gray-900 mb-2">제품 QR 스캔</h2>
                            <p className="text-gray-500 mb-10 max-w-sm ml-auto mr-auto">
                                서비스 신청을 위해 제품의 정품 인증 QR 코드를 스캔해 주세요.
                            </p>
                            <button
                                onClick={() => setIsQRScannerModalOpen(true)}
                                disabled={consentLoading}
                                className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-bold flex items-center gap-3 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95 disabled:opacity-50"
                            >
                                {consentLoading ? (
                                    <Loader2 size={20} className="animate-spin" />
                                ) : (
                                    <QrCode size={20} />
                                )}
                                스캔 시작하기
                            </button>

                            <button
                                onClick={() => setStep(1)}
                                className="mt-6 text-gray-400 hover:text-indigo-600 font-bold text-sm transition-colors cursor-pointer flex items-center gap-1"
                            >
                                <ArrowRight className="rotate-180" size={14} />
                                다른 업체 선택하기
                            </button>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="p-10 flex-1 flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-500">
                            <div className="w-24 h-24 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-6 shadow-inner">
                                <CheckCircleIcon size={48} />
                            </div>
                            <h2 className="text-2xl font-extrabold text-gray-900 mb-2">신청 완료</h2>
                            <p className="text-gray-500 mb-2 font-medium">
                                <span className="text-indigo-600 font-bold">{selectedProvider?.name || selectedProvider?.tenantId}</span> 업체에
                                <br />성공적으로 서비스 신청을 완료했습니다.
                            </p>
                            <p className="text-xs text-gray-400 mb-10">
                                담당 업체가 내용을 확인한 후 연락드릴 예정입니다.
                            </p>

                            <div className="flex gap-4 w-full max-w-sm">
                                <button
                                    onClick={() => navigate('/')}
                                    className="flex-1 bg-gray-900 text-white px-6 py-4 rounded-2xl font-bold hover:bg-gray-800 transition-all active:scale-95 shadow-lg"
                                >
                                    메인으로
                                </button>
                                <button
                                    onClick={() => {
                                        setStep(1);
                                        setScannedPassportId(null);
                                        setSelectedProvider(null);
                                    }}
                                    className="flex-1 bg-white text-gray-700 border border-gray-200 px-6 py-4 rounded-2xl font-bold hover:bg-gray-50 transition-all"
                                >
                                    추가 신청
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <ModernScanner
                isOpen={isQRScannerModalOpen}
                onClose={() => setIsQRScannerModalOpen(false)}
                onScan={handleQRScanSuccess}
                title="제품 QR 스캔"
            />
        </div>
    );
};

// Simple success icon
const CheckCircleIcon = ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
);

export default ServiceApplication;
