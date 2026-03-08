import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Search, ChevronLeft, ChevronRight, QrCode, PackageCheck, X } from 'lucide-react';
import useAuthStore from '../../store/useAuthStore';
import QRScannerModal from '../../components/shipment/QRScannerModal';

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

const DistributionManagement = () => {
    const { user, myMemberships } = useAuthStore();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
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

    const currentMembership = user?.tenantId
        ? myMemberships.find((m) =>
            m.tenantId === user.tenantId &&
            String(m.status).toUpperCase() === 'ACTIVE'
        )
        : null;

    const fetchHistory = async (p = 0, k = '') => {
        if (!user?.tenantId) return;
        setLoading(true);
        try {
            const query = new URLSearchParams({
                page: p,
                size: pageSize,
                ...(k && { keyword: k })
            }).toString();
            // Using the same shipment history API as requested
            const data = await apiFetch(`/workflows/shipments?${query}`);
            setHistory(data.content || []);
            setTotalPages(data.totalPages || 0);
            setTotalElements(data.totalElements || 0);
        } catch (error) {
            console.error("Failed to fetch distribution history:", error);
            alert("유통 이력 목록을 불러오지 못했습니다.");
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
            alert("파트너 목록을 불러오지 못했습니다.");
        } finally {
            setPartnerLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory(0, searchTerm);
    }, [user?.tenantId]);

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
        setIsQRScannerModalOpen(false);

        let passportId = decodedText;
        if (decodedText.includes('passports/')) {
            const parts = decodedText.split('passports/');
            if (parts.length > 1) {
                passportId = parts[1].split('/')[0];
            }
        }

        if (!passportId) {
            alert("QR 코드에서 올바른 정보를 추출할 수 없습니다.");
            return;
        }

        setScannedPassportId(passportId);
        setIsPartnerModalOpen(true);
        fetchPartnerLinks();
    };

    const handleGrantDelegation = async (partnerLink) => {
        if (!scannedPassportId || !currentMembership?.tenantId) return;

        const partnerName = partnerLink.targetTenantName || partnerLink.targetTenantId;
        if (!window.confirm(`${partnerName} 업체에게 이 제품의 판매 권한을 위임하시겠습니까?`)) {
            return;
        }

        setGrantLoading(true);
        try {
            // POST /workflows/tenants/{sourceTenantId}/delegations
            await apiFetch(`/workflows/tenants/${currentMembership.tenantId}/delegations`, {
                method: 'POST',
                body: JSON.stringify({
                    partnerLinkId: partnerLink.partnerLinkId,
                    resourceType: "PASSPORT",
                    resourceId: scannedPassportId,
                    permissionCode: "RETAIL_TRANSFER_CREATE",
                    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days default
                    note: "유통 관리 메뉴를 통한 위임"
                })
            });

            alert("권한 위임이 완료되었습니다.");
            setIsPartnerModalOpen(false);
            setScannedPassportId(null);
            fetchHistory(page, searchTerm); // Refresh list
        } catch (error) {
            console.error("Failed to grant delegation:", error);
            alert(`위임 실패: ${error.message}`);
        } finally {
            setGrantLoading(false);
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
                        출고된 제품의 유통 경로 및 이력을 관리하고 파트너에게 권한을 위임합니다.
                    </p>
                </div>
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
                    <button
                        onClick={() => setIsQRScannerModalOpen(true)}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 cursor-pointer"
                    >
                        <QrCode size={18} />
                        QR 유통
                    </button>
                    <div className="bg-gray-50 text-gray-600 px-4 py-2 rounded-xl text-sm font-bold flex items-center">
                        총 {totalElements}건
                    </div>
                </div>
            </div>

            {/* Main Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">제품 정보 (Model / SN)</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">출고 정보 (Shipment ID)</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">상태 / 일시</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">상세</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {loading ? (
                            <tr>
                                <td colSpan="4" className="px-6 py-12 text-center text-gray-400">
                                    데이터를 불러오는 중입니다...
                                </td>
                            </tr>
                        ) : history.length === 0 ? (
                            <tr>
                                <td colSpan="4" className="px-6 py-12 text-center text-gray-400">
                                    <PackageCheck size={32} className="mx-auto mb-3 opacity-50" />
                                    유통 이력 내역이 없습니다.
                                </td>
                            </tr>
                        ) : (
                            history.map((h) => (
                                <tr key={h.shipmentId} className="hover:bg-gray-50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-bold text-gray-900">{h.modelName || '-'}</div>
                                        <div className="text-[10px] text-gray-500 font-medium mt-0.5">{h.serialNumber}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-xs font-mono text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded inline-block">
                                            {h.shipmentId.substring(0, 8)}...
                                        </div>
                                        <div className="text-[10px] text-gray-400 mt-1">회차: {h.shipmentRound}회</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${h.status === 'RELEASED' ? 'bg-green-100 text-green-700' :
                                            h.status === 'RETURNED' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700'
                                            }`}>
                                            {h.status === 'RELEASED' ? '출고완료' : h.status === 'RETURNED' ? '반송완료' : h.status}
                                        </span>
                                        <div className="text-[10px] text-gray-400 mt-1">
                                            {h.releasedAt ? new Date(h.releasedAt).toLocaleString() : '-'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <Link
                                            to={`/brand/shipments/${h.shipmentId}`}
                                            className="px-3 py-1.5 bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-xs font-bold hover:bg-gray-100 transition-colors inline-flex items-center justify-center"
                                        >
                                            상세보기
                                        </Link>
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
