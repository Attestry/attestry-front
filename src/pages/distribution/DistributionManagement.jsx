import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Search, ChevronLeft, ChevronRight, QrCode, PackageCheck, X } from 'lucide-react';
import useAuthStore from '../../store/useAuthStore';
import QRScannerModal from '../../components/shipment/QRScannerModal';
import { apiFetchJson } from '../../utils/api';
import { createHttpError, getCurrentMembership, hasEffectiveScope, normalizeApiErrorMessage, toPermissionMessage } from '../../utils/permissionUi';
import { parsePassportIdFromQr } from '../../utils/qrPayload';

const apiFetch = async (url, options = {}) => {
    const token = useAuthStore.getState().accessToken;
    return apiFetchJson(url, options, {
        token,
        fallbackMessage: normalizeApiErrorMessage('', undefined)
    });
};

const DistributionManagement = () => {
    const { user, myMemberships } = useAuthStore();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('candidates');
    const [page, setPage] = useState(0);
    const [pageSize] = useState(20);
    const [totalPages, setTotalPages] = useState(0);
    const [totalElements, setTotalElements] = useState(0);
    const [isQRScannerModalOpen, setIsQRScannerModalOpen] = useState(false);

    // New states for Delegation Flow
    const [scannedPassportId, setScannedPassportId] = useState(null);
    const [partnerLinks, setPartnerLinks] = useState([]);
    const [partnerLoading, setPartnerLoading] = useState(false);
    const [partnerSearchTerm, setPartnerSearchTerm] = useState('');
    const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false);
    const [grantLoading, setGrantLoading] = useState(false);

    const currentMembership = getCurrentMembership(myMemberships, user?.tenantId);

    const hasDistributionPermission = hasEffectiveScope(currentMembership, 'DELEGATION_GRANT');

    const fetchHistory = async (p = 0, k = '') => {
        if (!user?.tenantId) return;

        setLoading(true);
        setError('');
        try {
            if (activeTab === 'candidates') {
                const query = new URLSearchParams({
                    page: p,
                    size: pageSize,
                    ...(k && { keyword: k })
                }).toString();
                // GET /workflows/distributions/candidates
                const data = await apiFetch(`/workflows/distributions/candidates?${query}`);
                setHistory(data.content || []);
                setTotalPages(data.totalPages || 0);
                setTotalElements(data.totalElements || 0);
            } else {
                const query = new URLSearchParams({
                    page: p,
                    size: pageSize,
                    ...(k && { keyword: k })
                }).toString();
                // GET /workflows/tenants/{tenantId}/distributions?page=...&size=...&keyword=...
                const data = await apiFetch(`/workflows/tenants/${currentMembership?.tenantId || user.tenantId}/distributions?${query}`);

                setHistory(data.content || []);
                setTotalPages(data.totalPages || 0);
                setTotalElements(data.totalElements || 0);
            }
        } catch (error) {
            console.error(`Failed to fetch distribution ${activeTab}:`, error);
            setHistory([]);
            setTotalPages(0);
            setTotalElements(0);
            setError(toPermissionMessage(error, 'DEFAULT', `${activeTab === 'candidates' ? '유통 대기' : '유통 이력'} 목록을 불러오지 못했습니다.`));
        } finally {
            setLoading(false);
        }
    };

    const fetchPartnerLinks = async () => {
        setPartnerLoading(true);
        try {
            // GET /workflows/partner-links?status=ACTIVE
            const data = await apiFetch('/workflows/partner-links?status=ACTIVE');
            setPartnerLinks(data || []);
        } catch (error) {
            console.error("Failed to fetch partner links:", error);
            setError(toPermissionMessage(error, 'DEFAULT', '파트너 목록을 불러오지 못했습니다.'));
        } finally {
            setPartnerLoading(false);
        }
    };

    const ensureDistributionCandidate = async (passportId) => {
        const query = new URLSearchParams({
            page: 0,
            size: 20,
            keyword: passportId
        }).toString();
        const data = await apiFetch(`/workflows/distributions/candidates?${query}`);
        const matchedCandidate = (data.content || []).find((candidate) => candidate.passportId === passportId);
        return { matchedCandidate, data };
    };

    useEffect(() => {
        setPage(0);
        fetchHistory(0, searchTerm);
    }, [user?.tenantId, activeTab]);

    useEffect(() => {
        const handler = setTimeout(() => {
            setPage(0);
            fetchHistory(0, searchTerm);
        }, 500);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    const handlePageChange = (newPage) => {
        if (newPage < 0 || newPage >= totalPages) return;
        setPage(newPage);
        fetchHistory(newPage, searchTerm);
    };

    const handleQRScanSuccess = (decodedText) => {
        void (async () => {
            setIsQRScannerModalOpen(false);

            const passportId = parsePassportIdFromQr(decodedText);
            if (!passportId) {
                alert("QR 코드에서 올바른 제품 식별자를 추출할 수 없습니다.");
                return;
            }

            if (!currentMembership?.tenantId) {
                alert("현재 선택된 운영 테넌트 정보를 확인할 수 없습니다. 다시 로그인하거나 역할을 확인해 주세요.");
                return;
            }

            setLoading(true);
            setError('');
            try {
                const existingCandidate = history.find((item) => item.passportId === passportId);
                let matchedCandidate = existingCandidate;
                let candidateData = null;

                if (!matchedCandidate) {
                    const result = await ensureDistributionCandidate(passportId);
                    matchedCandidate = result.matchedCandidate;
                    candidateData = result.data;
                }

                if (!matchedCandidate) {
                    alert("해당 제품은 현재 유통 위임 가능한 상태가 아닙니다. 이미 위임되었거나 권한 범위 밖의 제품일 수 있습니다.");
                    return;
                }

                if (candidateData) {
                    setHistory(candidateData.content || []);
                    setTotalPages(candidateData.totalPages || 0);
                    setTotalElements(candidateData.totalElements || 0);
                    setSearchTerm(passportId);
                    setPage(0);
                    setActiveTab('candidates');
                }

                setScannedPassportId(passportId);
                setIsPartnerModalOpen(true);
                await fetchPartnerLinks();
            } catch (error) {
                console.error("Failed to validate distribution candidate via QR:", error);
                setError(toPermissionMessage(error, 'DELEGATION_GRANT', 'QR로 스캔한 제품을 유통 대기 목록에서 확인하지 못했습니다.'));
            } finally {
                setLoading(false);
            }
        })();
    };

    const handleGrantDelegation = async (partnerLink) => {
        if (!scannedPassportId || !currentMembership?.tenantId) return;

        const partnerName = partnerLink.targetTenantName || partnerLink.targetTenantId;
        if (!window.confirm(`${partnerName} 업체에게 이 제품의 판매 권한을 위임하시겠습니까?`)) {
            return;
        }

        setGrantLoading(true);
        try {
            // POST /workflows/tenants/{sourceTenantId}/partners/{partnerLinkId}/distributions
            await apiFetch(`/workflows/tenants/${currentMembership.tenantId}/partners/${partnerLink.partnerLinkId}/distributions`, {
                method: 'POST',
                body: JSON.stringify({
                    passportIds: [scannedPassportId],
                    expiresAt: null,
                    note: "유통 관리 메뉴를 통한 위임"
                })
            });

            alert("권한 위임이 완료되었습니다.");
            setIsPartnerModalOpen(false);
            setScannedPassportId(null);
            fetchHistory(page, searchTerm); // Refresh list
        } catch (error) {
            console.error("Failed to grant delegation:", error);
            alert(`위임 실패: ${toPermissionMessage(error, 'DELEGATION_GRANT', '권한 위임에 실패했습니다.')}`);
        } finally {
            setGrantLoading(false);
        }
    };

    const handleRecallDistribution = async (distributionId) => {
        if (!distributionId) return;

        if (!window.confirm("이 유통 건을 취소(회수)하시겠습니까? 취소 시 파트너의 해당 제품 권한이 즉시 만료됩니다.")) {
            return;
        }

        setLoading(true);
        try {
            // POST /workflows/distributions/{distributionId}/recall
            await apiFetch(`/workflows/distributions/${distributionId}/recall`, {
                method: 'POST',
                body: JSON.stringify({ reason: "사용자 요청에 의한 유통 취소" })
            });

            alert("유통 취소가 완료되었습니다.");
            fetchHistory(page, searchTerm); // Refresh list
        } catch (error) {
            console.error("Failed to recall distribution:", error);
            alert(`취소 실패: ${toPermissionMessage(error, 'DELEGATION_GRANT', '유통 취소에 실패했습니다.')}`);
        } finally {
            setLoading(false);
        }
    };

    const filteredPartners = partnerLinks.filter(p =>
        p.targetTenantId.toLowerCase().includes(partnerSearchTerm.toLowerCase()) ||
        (p.targetTenantName && p.targetTenantName.toLowerCase().includes(partnerSearchTerm.toLowerCase()))
    );

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header Section */}
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
                        <RefreshCw className="text-indigo-600" size={32} />
                        유통 관리 (Distribution Management)
                    </h1>
                    <p className="text-gray-500 mt-2 font-medium">
                        출고된 제품의 권한을 파트너에게 위임하거나 위임 이력을 관리합니다.
                    </p>
                </div>
            </div>

            {error && (
                <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {error}
                </div>
            )}

            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-6 gap-8">
                <button
                    onClick={() => setActiveTab('candidates')}
                    className={`pb-4 text-sm font-bold transition-colors cursor-pointer ${activeTab === 'candidates' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400 hover:text-gray-600 border-b-2 border-transparent'}`}
                >
                    유통 대기 (Candidates)
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`pb-4 text-sm font-bold transition-colors cursor-pointer ${activeTab === 'history' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400 hover:text-gray-600 border-b-2 border-transparent'}`}
                >
                    유통 이력 (History)
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center justify-between mb-6">
                <div className="relative flex-1 min-w-[300px] max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="모델명, 시리얼 또는 ID 검색..."
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-100 transition-shadow"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    {hasDistributionPermission && (
                        <button
                            type="button"
                            onClick={() => setIsQRScannerModalOpen(true)}
                            className="px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors shadow-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100 cursor-pointer"
                        >
                            <QrCode size={18} />
                            QR 유통
                        </button>
                    )}
                    <div className="bg-gray-50 text-gray-600 px-4 py-2 rounded-xl text-sm font-bold flex items-center">
                        총 {totalElements}건
                    </div>
                </div>
            </div>

            {!hasDistributionPermission && (
                <div className="mb-6 text-sm text-gray-500">
                    유통 위임과 회수는 관련 권한이 있는 멤버만 사용할 수 있습니다.
                </div>
            )}

            {/* Main Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        {activeTab === 'candidates' ? (
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">제품 정보 (Model / SN)</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">유통 대기 정보 (Passport ID)</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">공장 / 생산 (Factory)</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">관리</th>
                            </tr>
                        ) : (
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">위임 파트너 (Tenant)</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">유통 제품 정보</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">권한 정보</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">상태 / 만료일시</th>
                            </tr>
                        )}
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {loading ? (
                            <tr>
                                <td colSpan="4" className="px-6 py-12 text-center text-gray-400">
                                    데이터를 불러오는 중입니다...
                                </td>
                            </tr>
                        ) : activeTab === 'candidates' ? (
                            history.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-12 text-center text-gray-400">
                                        <PackageCheck size={32} className="mx-auto mb-3 opacity-50" />
                                        유통 대기 중인 제품이 없습니다.
                                    </td>
                                </tr>
                            ) : (
                                history.map((h) => (
                                    <tr key={h.passportId} className="hover:bg-gray-50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <Link to={`/brand/products/${h.passportId}`} className="block">
                                                <div className="text-sm font-bold text-gray-900 group-hover:text-indigo-600">{h.modelName || '-'}</div>
                                                <div className="text-[10px] text-gray-500 font-medium mt-0.5">{h.serialNumber}</div>
                                            </Link>
                                        </td>
                                        <td className="px-6 py-4">
                                            <Link to={`/brand/products/${h.passportId}`} className="block">
                                                <div className="text-xs font-mono text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded inline-block">
                                                    {h.passportId ? h.passportId.substring(0, 12) + '...' : '-'}
                                                </div>
                                                <div className="text-[10px] text-gray-400 mt-1">Asset ID: {h.assetId ? h.assetId.substring(0, 8) + '...' : '-'}</div>
                                            </Link>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-xs font-bold text-gray-700">{h.factoryCode || '-'}</div>
                                            <div className="text-[10px] text-gray-400 mt-1">{h.productionBatch || ''}</div>
                                        </td>
                                        <td className="px-6 py-4 text-right flex justify-end gap-2">
                                            {hasDistributionPermission && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setScannedPassportId(h.passportId);
                                                        setIsPartnerModalOpen(true);
                                                        fetchPartnerLinks();
                                                    }}
                                                    className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors inline-flex items-center justify-center shadow-sm bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-600 hover:text-white cursor-pointer"
                                                >
                                                    유통
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )
                        ) : history.length === 0 ? (
                            <tr>
                                <td colSpan="4" className="px-6 py-12 text-center text-gray-400">
                                    <PackageCheck size={32} className="mx-auto mb-3 opacity-50" />
                                    유통 이력 내역이 없습니다.
                                </td>
                            </tr>
                        ) : (
                            history.map((h) => (
                                <tr key={h.distributionId} className="hover:bg-gray-50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-bold text-gray-900">{h.targetTenantName || h.targetTenantId}</div>
                                        <div className="text-[10px] text-gray-500 font-medium mt-0.5">
                                            {h.targetTenantType ? `${h.targetTenantType} | ` : ''}파트너십: {h.partnerLinkId ? h.partnerLinkId.substring(0, 8) + '...' : '-'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <Link to={`/brand/products/${h.passportId}`} className="block">
                                            <div className="text-sm font-bold text-gray-900 group-hover:text-indigo-600">{h.modelName || h.passportId}</div>
                                            <div className="text-[10px] text-gray-500 font-medium mt-0.5">{h.serialNumber || '-'}</div>
                                        </Link>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${h.status === 'DISTRIBUTED' ? 'bg-green-100 text-green-700' :
                                            h.status === 'RECALLED' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700'
                                            }`}>
                                            {h.status === 'DISTRIBUTED' ? '유통완료' : h.status === 'RECALLED' ? '회수됨' : h.status}
                                        </span>
                                        <div className="text-[10px] text-gray-400 mt-1">
                                            실행자: {h.distributedByUserId || '-'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right flex justify-end gap-2 items-center">
                                        <div className="text-[10px] text-gray-500 font-medium whitespace-nowrap">
                                            {h.distributedAt ? new Date(h.distributedAt).toLocaleString() : '-'}
                                        </div>
                                        {h.status === 'DISTRIBUTED' && hasDistributionPermission && (
                                            <button
                                                type="button"
                                                onClick={() => handleRecallDistribution(h.distributionId)}
                                                className="ml-2 px-2 py-1 rounded text-[10px] font-bold transition-colors bg-red-50 text-red-600 border border-red-100 hover:bg-red-600 hover:text-white cursor-pointer"
                                            >
                                                취소
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {/* Pagination */}
                {totalPages > 0 && (
                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                        <div className="text-sm text-gray-500">
                            총 <span className="font-bold text-gray-900">{totalElements}</span>개 중 {page * pageSize + 1}-{Math.min((page + 1) * pageSize, totalElements)} 표시
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => handlePageChange(page - 1)}
                                disabled={page === 0 || loading}
                                className="p-2 border border-gray-200 rounded-lg hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <div className="flex items-center gap-1">
                                {[...Array(totalPages)].map((_, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handlePageChange(i)}
                                        className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors ${page === i ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-white border border-transparent hover:border-gray-200'}`}
                                    >
                                        {i + 1}
                                    </button>
                                )).filter((_, i) => {
                                    return i === 0 || i === totalPages - 1 || Math.abs(i - page) <= 1;
                                }).reduce((acc, curr, i, arr) => {
                                    if (i > 0 && curr.key - arr[i - 1].key > 1) {
                                        acc.push(<span key={`ellipsis-${i}`} className="text-gray-400 px-1">...</span>);
                                    }
                                    acc.push(curr);
                                    return acc;
                                }, [])}
                            </div>
                            <button
                                onClick={() => handlePageChange(page + 1)}
                                disabled={page >= totalPages - 1 || loading}
                                className="p-2 border border-gray-200 rounded-lg hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Partner Selection Modal */}
            {isPartnerModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsPartnerModalOpen(false)} />
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md relative animate-in fade-in zoom-in duration-200 flex flex-col max-h-[80vh]">
                        <div className="flex justify-between items-center p-6 border-b border-gray-100">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">유통 파트너 선택</h2>
                                <p className="text-sm text-gray-500 mt-1">권한을 위임할 파트너 업체를 선택하세요.</p>
                            </div>
                            <button onClick={() => setIsPartnerModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-2"><X size={20} /></button>
                        </div>

                        <div className="p-4 border-b border-gray-50">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="파트너 업체명 검색..."
                                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-100"
                                    value={partnerSearchTerm}
                                    onChange={(e) => setPartnerSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {partnerLoading ? (
                                <div className="text-center py-8 text-gray-400 text-sm">파트너 목록 로딩 중...</div>
                            ) : filteredPartners.length === 0 ? (
                                <div className="text-center py-8 text-gray-400 text-sm">검색 결과가 없습니다.</div>
                            ) : (
                                filteredPartners.map((p) => (
                                    <button
                                        key={p.partnerLinkId}
                                        disabled={grantLoading}
                                        onClick={() => handleGrantDelegation(p)}
                                        className="w-full text-left p-4 rounded-xl border border-gray-100 hover:border-indigo-300 hover:bg-indigo-50 transition-all group flex justify-between items-center"
                                    >
                                        <div>
                                            <div className="font-bold text-gray-900 group-hover:text-indigo-700">
                                                {p.targetTenantName || p.targetTenantId}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">
                                                ID: {p.targetTenantId} | {p.partnerType}
                                            </div>
                                        </div>
                                        <ChevronRight size={18} className="text-gray-300 group-hover:text-indigo-500" />
                                    </button>
                                ))
                            )}
                        </div>

                        <div className="p-6 bg-gray-50 border-t border-gray-100 rounded-b-2xl">
                            <button
                                onClick={() => setIsPartnerModalOpen(false)}
                                className="w-full py-2.5 text-sm font-bold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50"
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <QRScannerModal
                isOpen={isQRScannerModalOpen}
                onClose={() => setIsQRScannerModalOpen(false)}
                onScanSuccess={handleQRScanSuccess}
            />
        </div>
    );
};

export default DistributionManagement;
