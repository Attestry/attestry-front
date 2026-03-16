import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PackageCheck, UploadCloud, X, Loader2, FileText, Search, ChevronLeft, ChevronRight, QrCode } from 'lucide-react';
import useAuthStore from '../../store/useAuthStore';
import QRScannerModal from '../../components/shipment/QRScannerModal';
import { apiFetchJson } from '../../utils/api';
import { PERMISSION_GUIDES, createHttpError, getCurrentMembership, hasEffectiveScope, normalizeApiErrorMessage, toPermissionMessage } from '../../utils/permissionUi';
import { parsePassportIdFromQr } from '../../utils/qrPayload';

// Local API Fetch Helper matching the store
const apiFetch = async (url, options = {}) => {
    const token = useAuthStore.getState().accessToken;
    return apiFetchJson(url, options, {
        token,
        fallbackMessage: normalizeApiErrorMessage('', undefined)
    });
};

const calculateSHA256 = async (file) => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const ShipmentManagement = () => {
    const { user, myMemberships } = useAuthStore();
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const initialTab = queryParams.get('tab') === 'history' ? 'history' : 'candidates';

    const [candidates, setCandidates] = useState([]);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState(initialTab);

    // Paging states
    const [page, setPage] = useState(0);
    const [pageSize] = useState(20);
    const [totalPages, setTotalPages] = useState(0);
    const [totalElements, setTotalElements] = useState(0);

    // Modal state
    const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false);
    const [selectedCandidate, setSelectedCandidate] = useState(null);
    const [evidenceFiles, setEvidenceFiles] = useState([]);
    const [releaseLoading, setReleaseLoading] = useState(false);
    const [isQRScannerModalOpen, setIsQRScannerModalOpen] = useState(false);

    // Get current tenant's group info
    const currentMembership = getCurrentMembership(myMemberships, user?.tenantId, 'BRAND');

    // Release permission check: SCOPE_BRAND_RELEASE
    const hasReleasePermission = hasEffectiveScope(currentMembership, 'BRAND_RELEASE');

    const fetchCandidates = async (p = 0, k = '') => {
        if (!user?.tenantId) return;
        setLoading(true);
        setError('');
        try {
            const query = new URLSearchParams({
                page: p,
                size: pageSize,
                ...(k && { keyword: k })
            }).toString();
            const data = await apiFetch(`/workflows/shipments/release-candidates?${query}`);
            setCandidates(data.content || []);
            setTotalPages(data.totalPages || 0);
            setTotalElements(data.totalElements || 0);
        } catch (error) {
            console.error("Failed to fetch release candidates:", error);
            setCandidates([]);
            setTotalPages(0);
            setTotalElements(0);
            setError(toPermissionMessage(error, 'DEFAULT', '출고 대기 목록을 불러오지 못했습니다.'));
        } finally {
            setLoading(false);
            setHasLoadedOnce(true);
        }
    };

    const fetchHistory = async (p = 0, k = '') => {
        if (!user?.tenantId) return;
        setLoading(true);
        setError('');
        try {
            const query = new URLSearchParams({
                page: p,
                size: pageSize,
                ...(k && { keyword: k })
            }).toString();
            const data = await apiFetch(`/workflows/shipments?${query}`);
            setHistory(data.content || []);
            setTotalPages(data.totalPages || 0);
            setTotalElements(data.totalElements || 0);
        } catch (error) {
            console.error("Failed to fetch shipment history:", error);
            setHistory([]);
            setTotalPages(0);
            setTotalElements(0);
            setError(toPermissionMessage(error, 'DEFAULT', '출고 이력 목록을 불러오지 못했습니다.'));
        } finally {
            setLoading(false);
            setHasLoadedOnce(true);
        }
    };

    // Initial fetch and Tab switch
    useEffect(() => {
        setPage(0);
        if (activeTab === 'candidates') {
            fetchCandidates(0, searchTerm);
        } else {
            fetchHistory(0, searchTerm);
        }
    }, [user?.tenantId, activeTab]);

    // Debounced search fetch
    useEffect(() => {
        const handler = setTimeout(() => {
            setPage(0);
            if (activeTab === 'candidates') {
                fetchCandidates(0, searchTerm);
            } else {
                fetchHistory(0, searchTerm);
            }
        }, 500);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    const handlePageChange = (newPage) => {
        if (newPage < 0 || newPage >= totalPages) return;
        setPage(newPage);
        if (activeTab === 'candidates') {
            fetchCandidates(newPage, searchTerm);
        } else {
            fetchHistory(newPage, searchTerm);
        }
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            setEvidenceFiles(prev => [...prev, ...Array.from(e.target.files)]);
        }
    };

    const handleRemoveFile = (indexToRemove) => {
        setEvidenceFiles(prev => prev.filter((_, idx) => idx !== indexToRemove));
    };

    const handleReleaseSubmit = async (e) => {
        e.preventDefault();

        if (!selectedCandidate) return;
        if (evidenceFiles.length === 0) {
            alert('출고 증빙 서류를 업로드해 주세요.');
            return;
        }

        setReleaseLoading(true);
        try {
            let currentEvidenceGroupId = null;

            for (const file of evidenceFiles) {
                // 1. Presign Request
                const presignRes = await apiFetch('/workflows/shipments/evidences/presign', {
                    method: 'POST',
                    body: JSON.stringify({
                        evidenceGroupId: currentEvidenceGroupId,
                        fileName: file.name,
                        contentType: file.type || 'application/octet-stream' // fallback if empty
                    })
                });

                if (!presignRes.uploadUrl || !presignRes.evidenceId || !presignRes.evidenceGroupId) {
                    throw new Error("증빙 업로드 준비에 실패했습니다. 잠시 후 다시 시도해주세요.");
                }

                currentEvidenceGroupId = presignRes.evidenceGroupId;

                // 2. Upload to S3/Storage via Presigned URL
                const uploadRes = await fetch(presignRes.uploadUrl, {
                    method: 'PUT',
                    body: file,
                    headers: {
                        'Content-Type': file.type || 'application/octet-stream'
                    }
                });

                if (!uploadRes.ok) {
                    throw new Error(`${file.name} 파일 업로드에 실패했습니다. 다시 시도해주세요.`);
                }

                // 3. Optional: Generate actual file hash
                const fileHash = await calculateSHA256(file);

                // 4. Complete Evidence
                await apiFetch('/workflows/shipments/evidences/complete', {
                    method: 'POST',
                    body: JSON.stringify({
                        evidenceGroupId: currentEvidenceGroupId,
                        evidenceId: presignRes.evidenceId,
                        sizeBytes: file.size,
                        fileHash: fileHash
                    })
                });
            }

            // 5. Final Release
            await apiFetch(`/workflows/passports/${selectedCandidate.passportId}/shipments/release`, {
                method: 'POST',
                body: JSON.stringify({ evidenceGroupId: currentEvidenceGroupId })
            });

            alert('제품 출고가 성공적으로 완료되었습니다.');
            closeReleaseModal();
            fetchCandidates();

        } catch (error) {
            console.error(error);
            alert(`출고 실패: ${toPermissionMessage(error, 'BRAND_RELEASE', '출고 처리에 실패했습니다.')}`);
        } finally {
            setReleaseLoading(false);
        }
    };

    const openReleaseModal = (candidate) => {
        setSelectedCandidate(candidate);
        setEvidenceFiles([]);
        setIsReleaseModalOpen(true);
    };

    const closeReleaseModal = () => {
        setIsReleaseModalOpen(false);
        setSelectedCandidate(null);
        setEvidenceFiles([]);
    };

    const handleQRScanSuccess = async (decodedText) => {
        setIsQRScannerModalOpen(false);

        const passportId = parsePassportIdFromQr(decodedText);

        if (!passportId) {
            alert("QR 코드에서 올바른 정보를 추출할 수 없습니다.");
            return;
        }

        // 1. Check current candidates list if it's already there
        let candidate = candidates.find(c => c.passportId === passportId);

        if (!candidate) {
            // 2. Fetch from server using the passportId as keyword
            setLoading(true);
            try {
                const query = new URLSearchParams({
                    page: 0,
                    size: pageSize,
                    keyword: passportId
                }).toString();
                const data = await apiFetch(`/workflows/shipments/release-candidates?${query}`);
                const fetchedCandidates = data.content || [];

                // Update candidates list with the search results
                setCandidates(fetchedCandidates);
                setTotalPages(data.totalPages || 0);
                setTotalElements(data.totalElements || 0);
                setSearchTerm(passportId); // Optional: show what was searched
                setPage(0);

                candidate = fetchedCandidates.find(c => c.passportId === passportId);
            } catch (error) {
                console.error("Failed to search candidate via QR:", error);
                setError(toPermissionMessage(error, 'DEFAULT', '출고 대상을 검색하지 못했습니다.'));
            } finally {
                setLoading(false);
            }
        }

        if (candidate) {
            openReleaseModal(candidate);
        } else {
            alert("해당 제품을 출고 대기 목록에서 찾을 수 없습니다. 이미 출고되었거나 권한이 없는지 확인해 주세요.");
        }
    };

    // Local data points (always use the state from API)
    const currentList = activeTab === 'candidates' ? candidates : history;
    const showInitialLoading = loading && !hasLoadedOnce;
    const showRefreshing = loading && hasLoadedOnce;

    return (
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
            {/* Header Section */}
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                    <h1 className="flex flex-wrap items-center gap-3 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
                        <PackageCheck className="text-indigo-600" size={32} />
                        출고 관리 (Shipment Release)
                    </h1>
                    <p className="mt-2 text-sm font-medium leading-6 text-gray-500 sm:text-base">
                        생산 및 제품 등록(Mint)이 완료된 제품들을 외부로 출고 처리하거나 내역을 관리합니다.
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
                    출고 대기 (Candidates)
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`pb-4 text-sm font-bold transition-colors cursor-pointer ${activeTab === 'history' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400 hover:text-gray-600 border-b-2 border-transparent'}`}
                >
                    출고 이력 (History)
                </button>
            </div>

            {/* Config & Filters */}
            <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:gap-4">
                <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="모델명 또는 시리얼 번호 검색..."
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-100 transition-shadow"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    {activeTab === 'candidates' && hasReleasePermission && (
                        <button
                            type="button"
                            onClick={() => setIsQRScannerModalOpen(true)}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-100 transition-colors hover:bg-indigo-700 sm:w-auto sm:py-2 cursor-pointer"
                        >
                            <QrCode size={18} />
                            QR 출고
                        </button>
                    )}
                    <div className="flex items-center justify-center rounded-xl bg-gray-50 px-4 py-2 text-sm font-bold text-gray-600 sm:ml-auto">
                        총 {totalElements}건
                    </div>
                </div>
                {showRefreshing && (
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                        <Loader2 size={16} className="animate-spin" />
                        목록을 업데이트하는 중입니다...
                    </div>
                )}
            </div>

            {activeTab === 'candidates' && !hasReleasePermission && (
                <div className="mb-6 text-sm text-gray-500">
                    출고 처리 기능은 출고 권한이 있는 멤버만 사용할 수 있습니다.
                </div>
            )}

            {/* Main Table */}
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                <div className="md:hidden">
                    {showInitialLoading ? (
                        <div className="px-6 py-12 text-center text-gray-400">데이터를 불러오는 중입니다...</div>
                    ) : currentList.length === 0 ? (
                        <div className="px-6 py-12 text-center text-gray-400">
                            <PackageCheck size={32} className="mx-auto mb-3 opacity-50" />
                            {activeTab === 'candidates' ? '출고 대기 중인 제품 내역이 없습니다.' : '완료된 출고 이력이 없습니다.'}
                        </div>
                    ) : (
                        <div className="space-y-3 p-3">
                            {activeTab === 'candidates' ? currentList.map((c) => (
                                <div key={c.passportId} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                                    <Link to={`/${currentMembership?.groupType.toLowerCase()}/products/${c.passportId}`} className="block">
                                        <div className="text-base font-bold text-gray-900">{c.modelName}</div>
                                        <div className="mt-1 text-sm text-gray-600">{c.serialNumber}</div>
                                    </Link>
                                    <div className="mt-4 space-y-3 text-sm">
                                        <div>
                                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Passport ID</div>
                                            <div className="mt-1 break-all font-mono text-[12px] text-gray-600">{c.passportId}</div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">배치</div>
                                                <div className="mt-1 text-gray-700">{c.productionBatch || '배치 정보 없음'}</div>
                                            </div>
                                            <div>
                                                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">공장</div>
                                                <div className="mt-1 text-gray-700">{c.factoryCode || '-'}</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 flex flex-col gap-2">
                                        <Link
                                            to={`/${currentMembership?.groupType.toLowerCase()}/products/${c.passportId}`}
                                            className="inline-flex w-full items-center justify-center rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-bold text-gray-700"
                                        >
                                            상세보기
                                        </Link>
                                        {hasReleasePermission && (
                                            <button
                                                type="button"
                                                onClick={() => openReleaseModal(c)}
                                                className="inline-flex w-full items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-700"
                                            >
                                                출고 처리
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )) : currentList.map((h) => (
                                <div key={h.shipmentId} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                                    <Link to={`/${currentMembership?.groupType.toLowerCase()}/products/${h.passportId}`} className="block">
                                        <div className="text-base font-bold text-gray-900">{h.modelName || '-'}</div>
                                        <div className="mt-1 text-sm text-gray-600">{h.serialNumber}</div>
                                    </Link>
                                    <div className="mt-4 space-y-3 text-sm">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Shipment</div>
                                                <div className="mt-1 font-mono text-[12px] text-indigo-600">{h.shipmentId}</div>
                                            </div>
                                            <div>
                                                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">회차</div>
                                                <div className="mt-1 text-gray-700">{h.shipmentRound}회</div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">상태</div>
                                                <div className="mt-1">
                                                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${h.status === 'RELEASED' ? 'bg-green-100 text-green-700' : h.status === 'RETURNED' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700'}`}>
                                                        {h.status === 'RELEASED' ? '출고완료' : h.status === 'RETURNED' ? '반송완료' : h.status}
                                                    </span>
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">일시</div>
                                                <div className="mt-1 text-gray-700">{h.releasedAt ? new Date(h.releasedAt).toLocaleString() : '-'}</div>
                                            </div>
                                        </div>
                                    </div>
                                    <Link
                                        to={`/${currentMembership?.groupType.toLowerCase()}/shipments/${h.shipmentId}`}
                                        className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-bold text-gray-700"
                                    >
                                        상세보기
                                    </Link>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="hidden overflow-x-auto md:block">
                <table className="min-w-[860px] w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        {activeTab === 'candidates' ? (
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">제품 정보 (Model Name)</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">일련번호 (Serial / DPP ID)</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">생산 배치 정보</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">관리</th>
                            </tr>
                        ) : (
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">제품 정보 (Model / SN)</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">출고 정보 (Shipment ID)</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">상태 / 일시</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">상세</th>
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
                            currentList.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-12 text-center text-gray-400">
                                        <PackageCheck size={32} className="mx-auto mb-3 opacity-50" />
                                        출고 대기 중인 제품 내역이 없습니다.
                                    </td>
                                </tr>
                            ) : (
                                currentList.map((c) => (
                                    <tr key={c.passportId} className="hover:bg-gray-50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <Link
                                                to={`/${currentMembership?.groupType.toLowerCase()}/products/${c.passportId}`}
                                                className="block"
                                            >
                                                <div className="font-bold text-gray-900 group-hover:text-indigo-600">{c.modelName}</div>
                                            </Link>
                                        </td>
                                        <td className="px-6 py-4">
                                            <Link
                                                to={`/${currentMembership?.groupType.toLowerCase()}/products/${c.passportId}`}
                                                className="block"
                                            >
                                                <div className="text-sm font-medium text-gray-900 group-hover:text-indigo-600">{c.serialNumber}</div>
                                                <div className="text-[10px] text-gray-400 font-mono mt-0.5" title={c.passportId}>
                                                    ID: {c.passportId.substring(0, 8)}...{c.passportId.substring(c.passportId.length - 8)}
                                                </div>
                                            </Link>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-gray-600">
                                                {c.productionBatch || '배치 정보 없음'}
                                            </div>
                                            {c.factoryCode && (
                                                <div className="text-[10px] text-gray-400 mt-0.5">
                                                    공장: {c.factoryCode}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right flex justify-end gap-2">
                                            <Link
                                                to={`/${currentMembership?.groupType.toLowerCase()}/products/${c.passportId}`}
                                                className="px-3 py-1.5 bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-xs font-bold hover:bg-gray-100 transition-colors inline-flex items-center justify-center shadow-sm"
                                            >
                                                상세보기
                                            </Link>
                                            {hasReleasePermission && (
                                                <button
                                                    type="button"
                                                    onClick={() => openReleaseModal(c)}
                                                    className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors inline-flex items-center justify-center shadow-sm bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-600 hover:text-white cursor-pointer"
                                                >
                                                    출고 처리
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )
                        ) : (
                            currentList.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-12 text-center text-gray-400">
                                        <PackageCheck size={32} className="mx-auto mb-3 opacity-50" />
                                        완료된 출고 이력이 없습니다.
                                    </td>
                                </tr>
                            ) : (
                                currentList.map((h) => (
                                    <tr key={h.shipmentId} className="hover:bg-gray-50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <Link
                                                to={`/${currentMembership?.groupType.toLowerCase()}/products/${h.passportId}`}
                                                className="block"
                                            >
                                                <div className="text-sm font-bold text-gray-900 group-hover:text-indigo-600">{h.modelName || '-'}</div>
                                                <div className="text-[10px] text-gray-500 font-medium mt-0.5">{h.serialNumber}</div>
                                            </Link>
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
                                                to={`/${currentMembership?.groupType.toLowerCase()}/shipments/${h.shipmentId}`}
                                                className="px-3 py-1.5 bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-xs font-bold hover:bg-gray-100 transition-colors inline-flex items-center justify-center"
                                            >
                                                상세보기
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )
                        )}
                    </tbody>
                </table>
                </div>

                {/* Pagination */}
                {totalPages > 0 && (
                    <div className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                        <div className="text-sm text-gray-500">
                            총 <span className="font-bold text-gray-900">{totalElements}</span>개 중 {page * pageSize + 1}-{Math.min((page + 1) * pageSize, totalElements)} 표시
                        </div>
                        <div className="flex flex-wrap gap-2">
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
                                    // Show first, last, and around current page
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

            {/* Release Modal */}
            {isReleaseModalOpen && selectedCandidate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeReleaseModal} />
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md relative animate-in fade-in zoom-in duration-200">
                        {/* Header */}
                        <div className="flex justify-between items-center p-6 border-b border-gray-100">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">제품 출고 (Release)</h2>
                                <p className="text-sm text-gray-500 mt-1">출고를 위한 증빙 자료를 업로드하세요.</p>
                            </div>
                            <button
                                onClick={closeReleaseModal}
                                className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-full cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body */}
                        <form onSubmit={handleReleaseSubmit}>
                            <div className="p-6 space-y-6">
                                {/* Selected Product Info */}
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">출고 대상 제품</div>
                                    <div className="font-bold text-gray-900">{selectedCandidate.modelName}</div>
                                    <div className="text-sm text-gray-600 mt-1">S/N: {selectedCandidate.serialNumber}</div>
                                </div>

                                {/* Evidence Upload */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        출고 증빙 서류 (Evidence) <span className="text-red-500">*</span>
                                    </label>
                                    <div className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-xl transition-colors relative group ${evidenceFiles.length > 0 ? 'border-gray-200 bg-white' : 'border-gray-300 hover:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 bg-gray-50'}`}>
                                        <div className="space-y-4 text-center w-full">
                                            {evidenceFiles.length > 0 && (
                                                <div className="w-full flex justify-between items-center px-1">
                                                    <span className="text-sm font-bold text-gray-700">총 {evidenceFiles.length}개 파일 첨부됨</span>
                                                    <label htmlFor="file-upload-add" className="text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer flex items-center gap-1">
                                                        <UploadCloud size={14} /> 추가 첨부
                                                        <input id="file-upload-add" name="file-upload-add" type="file" multiple className="sr-only" onChange={handleFileChange} />
                                                    </label>
                                                </div>
                                            )}

                                            {evidenceFiles.length > 0 ? (
                                                <ul className="w-full space-y-2 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                                                    {evidenceFiles.map((file, idx) => (
                                                        <li key={idx} className="flex justify-between items-center p-3 bg-white border border-gray-200 rounded-lg shadow-sm group/item">
                                                            <div className="flex items-center gap-3 overflow-hidden">
                                                                <FileText size={18} className="text-indigo-500 shrink-0" />
                                                                <div className="truncate text-left flex-1 min-w-0">
                                                                    <div className="text-sm font-medium text-gray-900 truncate" title={file.name}>{file.name}</div>
                                                                    <div className="text-[10px] text-gray-500 font-mono">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                                                                </div>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveFile(idx)}
                                                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover/item:opacity-100"
                                                                title="파일 제거"
                                                            >
                                                                <X size={16} />
                                                            </button>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center w-full h-full py-4">
                                                    <UploadCloud className="h-12 w-12 text-gray-400 group-hover:text-indigo-500 transition-colors mb-2" />
                                                    <div className="text-sm text-gray-600">
                                                        <label
                                                            htmlFor="file-upload"
                                                            className="relative cursor-pointer bg-transparent rounded-md font-bold text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
                                                        >
                                                            <span>파일을 선택하세요</span>
                                                            <input
                                                                id="file-upload"
                                                                name="file-upload"
                                                                type="file"
                                                                multiple
                                                                className="sr-only"
                                                                onChange={handleFileChange}
                                                                accept="image/*,.pdf,.csv"
                                                            />
                                                        </label>
                                                    </div>
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        이미지, PDF, CSV 파일 복수 선택 가능 (최대 10MB)
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 rounded-b-2xl">
                                <button
                                    type="button"
                                    onClick={closeReleaseModal}
                                    className="px-5 py-2.5 text-sm font-bold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 transition-colors cursor-pointer"
                                    disabled={releaseLoading}
                                >
                                    취소
                                </button>
                                <button
                                    type="submit"
                                    disabled={releaseLoading || evidenceFiles.length === 0}
                                    className={`px-6 py-2.5 text-sm font-bold text-white rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors flex items-center gap-2 cursor-pointer
                                        ${releaseLoading || evidenceFiles.length === 0 ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                                >
                                    {releaseLoading ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            출고 진행 중...
                                        </>
                                    ) : (
                                        '출고 처리'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* QR Scanner Modal */}
            <QRScannerModal
                isOpen={isQRScannerModalOpen}
                onClose={() => setIsQRScannerModalOpen(false)}
                onScanSuccess={handleQRScanSuccess}
            />
        </div>
    );
};

export default ShipmentManagement;
