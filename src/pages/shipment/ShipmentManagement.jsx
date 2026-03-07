import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PackageCheck, UploadCloud, X, Loader2, FileText, Search } from 'lucide-react';
import useAuthStore from '../../store/useAuthStore';

// Local API Fetch Helper matching the store
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
        } catch (e) {
            // Ignore JSON parse error if body is empty
        }
        throw new Error(errorMsg);
    }

    if (response.status === 204) return null;
    return response.json();
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
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState(initialTab);

    // Modal state
    const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false);
    const [selectedCandidate, setSelectedCandidate] = useState(null);
    const [evidenceFiles, setEvidenceFiles] = useState([]);
    const [releaseLoading, setReleaseLoading] = useState(false);

    // Get current tenant's group info
    const currentMembership = user?.tenantId
        ? myMemberships.find((m) =>
            m.tenantId === user.tenantId &&
            String(m.status).toUpperCase() === 'ACTIVE' &&
            String(m.groupType).toUpperCase() === 'BRAND'
        )
        : null;

    // Release permission check: SCOPE_BRAND_RELEASE
    const hasReleasePermission = currentMembership?.effectiveScopes?.some((s) => {
        const scope = String(s).toUpperCase();
        return scope === 'BRAND_RELEASE' || scope === 'SCOPE_BRAND_RELEASE';
    }) ?? false;

    const fetchCandidates = async () => {
        if (!user?.tenantId) return;
        setLoading(true);
        try {
            const data = await apiFetch(`/workflows/shipments/release-candidates`);
            setCandidates(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Failed to fetch release candidates:", error);
            alert("출고 대기 목록을 불러오지 못했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const fetchHistory = async () => {
        if (!user?.tenantId) return;
        setLoading(true);
        try {
            const data = await apiFetch(`/workflows/shipments`);
            setHistory(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Failed to fetch shipment history:", error);
            alert("출고 이력 목록을 불러오지 못했습니다.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'candidates') {
            fetchCandidates();
        } else {
            fetchHistory();
        }
    }, [user?.tenantId, activeTab]);

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
                    throw new Error("Failed to get presigned URL from server.");
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
                    throw new Error(`Failed to upload file ${file.name} to storage.`);
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
            alert(`출고 실패: ${error.message}`);
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

    // Filter frontend (if keyword filtering is needed locally since the API doesn't specify query params)
    const filteredCandidates = candidates.filter(c =>
        (c.modelName && c.modelName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.serialNumber && c.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const filteredHistory = history.filter(h =>
        (h.passportId && h.passportId.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (h.shipmentId && h.shipmentId.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header Section */}
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
                        <PackageCheck className="text-indigo-600" size={32} />
                        출고 관리 (Shipment Release)
                    </h1>
                    <p className="text-gray-500 mt-2 font-medium">
                        생산 및 제품 등록(Mint)이 완료된 제품들을 외부로 출고 처리하거나 내역을 관리합니다.
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-6 gap-8">
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
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center justify-between mb-6">
                <div className="relative flex-1 min-w-[300px] max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder={activeTab === 'candidates' ? "모델명 또는 시리얼 번호 검색..." : "패스포트 ID 또는 출고 ID 검색..."}
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-100 transition-shadow"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    <div className="bg-gray-50 text-gray-600 px-4 py-2 rounded-xl text-sm font-bold flex items-center">
                        총 {activeTab === 'candidates' ? filteredCandidates.length : filteredHistory.length}건
                    </div>
                </div>
            </div>

            {/* Main Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        {activeTab === 'candidates' ? (
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">제품 정보 (Model Name)</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">일련번호 (Serial / DPP ID)</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">생산 배치 정보</th>
                                {hasReleasePermission && <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">관리</th>}
                            </tr>
                        ) : (
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">출고 정보 (Shipment ID)</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">대상 제품 (Passport ID)</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">상태 / 일시</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">상세</th>
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
                            filteredCandidates.length === 0 ? (
                                <tr>
                                    <td colSpan={hasReleasePermission ? "4" : "3"} className="px-6 py-12 text-center text-gray-400">
                                        <PackageCheck size={32} className="mx-auto mb-3 opacity-50" />
                                        출고 대기 중인 제품 내역이 없습니다.
                                    </td>
                                </tr>
                            ) : (
                                filteredCandidates.map((c) => (
                                    <tr key={c.passportId} className="hover:bg-gray-50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-900">{c.modelName}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium text-gray-900">{c.serialNumber}</div>
                                            <div className="text-[10px] text-gray-400 font-mono mt-0.5" title={c.passportId}>
                                                ID: {c.passportId.substring(0, 8)}...{c.passportId.substring(c.passportId.length - 8)}
                                            </div>
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
                                        {hasReleasePermission && (
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => openReleaseModal(c)}
                                                    className="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold hover:bg-indigo-600 hover:text-white transition-colors cursor-pointer inline-flex items-center justify-center shadow-sm"
                                                >
                                                    출고 처리
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )
                        ) : (
                            filteredHistory.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-12 text-center text-gray-400">
                                        <PackageCheck size={32} className="mx-auto mb-3 opacity-50" />
                                        완료된 출고 이력이 없습니다.
                                    </td>
                                </tr>
                            ) : (
                                filteredHistory.map((h) => (
                                    <tr key={h.shipmentId} className="hover:bg-gray-50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-bold text-gray-900">{h.shipmentId.substring(0, 8)}...</div>
                                            <div className="text-[10px] text-gray-400 font-mono">Full: {h.shipmentId}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-xs font-mono text-gray-600">
                                                {h.passportId.substring(0, 8)}...{h.passportId.substring(h.passportId.length - 8)}
                                            </div>
                                            <div className="text-[10px] text-gray-400 mt-0.5">회차: {h.shipmentRound}회</div>
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
        </div>
    );
};

export default ShipmentManagement;
