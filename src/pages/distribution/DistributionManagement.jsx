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
    const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
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
            setHasLoadedOnce(true);
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
    const showInitialLoading = loading && !hasLoadedOnce;
    const showRefreshing = loading && hasLoadedOnce;

    return (
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
            {/* Header Section */}
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                    <h1 className="flex flex-wrap items-center gap-3 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
                        <RefreshCw className="text-indigo-600" size={32} />
                        유통 관리 (Distribution Management)
                    </h1>
                    <p className="mt-2 text-sm font-medium leading-6 text-gray-500 sm:text-base">
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
            <div className="mb-6 flex gap-6 overflow-x-auto border-b border-gray-200">
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
            <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:gap-4">
                <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="모델명, 시리얼 또는 ID 검색..."
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-100 transition-shadow"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    {hasDistributionPermission && (
                        <button
                            type="button"
                            onClick={() => setIsQRScannerModalOpen(true)}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-100 transition-colors hover:bg-indigo-700 sm:w-auto sm:py-2 cursor-pointer"
                        >
                            <QrCode size={18} />
                            QR 유통
                        </button>
                    )}
                    <div className="flex items-center justify-center rounded-xl bg-gray-50 px-4 py-2 text-sm font-bold text-gray-600 sm:ml-auto">
                        총 {totalElements}건
                    </div>
                </div>
                {showRefreshing && (
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                        <RefreshCw size={16} className="animate-spin" />
                        목록을 업데이트하는 중입니다...
                    </div>
                )}
            </div>

            {!hasDistributionPermission && (
                <div className="mb-6 text-sm text-gray-500">
                    유통 위임과 회수는 관련 권한이 있는 멤버만 사용할 수 있습니다.
                </div>
            )}

            {/* Main Table */}
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                <div className="md:hidden">
                    {showInitialLoading ? (
                        <div className="px-6 py-12 text-center text-gray-400">데이터를 불러오는 중입니다...</div>
                    ) : history.length === 0 ? (
                        <div className="px-6 py-12 text-center text-gray-400">
                            <PackageCheck size={32} className="mx-auto mb-3 opacity-50" />
                            {activeTab === 'candidates' ? '유통 대기 중인 제품이 없습니다.' : '유통 이력 내역이 없습니다.'}
                        </div>
                    ) : (
                        <div className="space-y-3 p-3">
                            {activeTab === 'candidates' ? history.map((h) => (
                                <div key={h.passportId} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                                    <Link to={`/brand/products/${h.passportId}`} className="block">
                                        <div className="text-base font-bold text-gray-900">{h.modelName || '-'}</div>
                                        <div className="mt-1 text-sm text-gray-600">{h.serialNumber}</div>
                                    </Link>
                                    <div className="mt-4 space-y-3 text-sm">
                                        <div>
                                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Passport ID</div>
                                            <div className="mt-1 break-all font-mono text-[12px] text-indigo-600">{h.passportId || '-'}</div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">공장</div>
                                                <div className="mt-1 text-gray-700">{h.factoryCode || '-'}</div>
                                            </div>
                                            <div>
                                                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">배치</div>
                                                <div className="mt-1 text-gray-700">{h.productionBatch || '-'}</div>
                                            </div>
                                        </div>
                                    </div>
                                    {hasDistributionPermission && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setScannedPassportId(h.passportId);
                                                setIsPartnerModalOpen(true);
                                                fetchPartnerLinks();
                                            }}
                                            className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-700"
                                        >
                                            유통
                                        </button>
                                    )}
                                </div>
                            )) : history.map((h) => (
                                <div key={h.distributionId} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                                    <div className="text-base font-bold text-gray-900">{h.targetTenantName || h.targetTenantId}</div>
                                    <div className="mt-1 text-xs text-gray-500">
                                        {h.targetTenantType ? `${h.targetTenantType} | ` : ''}파트너십: {h.partnerLinkId ? h.partnerLinkId.substring(0, 8) + '...' : '-'}
                                    </div>
                                    <Link to={`/brand/products/${h.passportId}`} className="mt-4 block">
                                        <div className="text-sm font-bold text-gray-900">{h.modelName || h.passportId}</div>
                                        <div className="mt-1 text-sm text-gray-600">{h.serialNumber || '-'}</div>
                                    </Link>
                                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">상태</div>
                                            <div className="mt-1">
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${h.status === 'DISTRIBUTED' ? 'bg-green-100 text-green-700' : h.status === 'RECALLED' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700'}`}>
                                                    {h.status === 'DISTRIBUTED' ? '유통완료' : h.status === 'RECALLED' ? '회수됨' : h.status}
                                                </span>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">일시</div>
                                            <div className="mt-1 text-gray-700">{h.distributedAt ? new Date(h.distributedAt).toLocaleString() : '-'}</div>
                                        </div>
                                    </div>
                                    <div className="mt-3 text-xs text-gray-500">실행자: {h.distributedByUserId || '-'}</div>
                                    {h.status === 'DISTRIBUTED' && hasDistributionPermission && (
                                        <button
                                            type="button"
                                            onClick={() => handleRecallDistribution(h.distributionId)}
                                            className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-bold text-red-600"
                                        >
                                            취소
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="hidden overflow-x-auto md:block">
                <table className="min-w-[900px] w-full text-left">
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
                        {showInitialLoading ? (
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
                </div>

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
