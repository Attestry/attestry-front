import React, { useState, useEffect, useCallback } from 'react';
import {
    ClipboardList,
    Search,
    Filter,
    MoreVertical,
    CheckCircle2,
    XCircle,
    Clock,
    AlertCircle,
    Loader2,
    ChevronRight,
    ChevronLeft,
    Wrench,
    MessageSquare,
    Package,
    FileText,
    QrCode,
    UploadCloud,
    X
} from 'lucide-react';
import useAuthStore from '../../store/useAuthStore';
import WhiteScannerModal from '../../components/common/WhiteScannerModal';

const calculateSHA256 = async (file) => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const ServiceRequests = () => {
    const {
        user,
        fetchReceivedServiceRequests,
        acceptServiceRequest,
        rejectServiceRequest,
        completeServiceRequest,
        presignServiceProviderEvidence,
        completeServiceProviderEvidence
    } = useAuthStore();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeStatus, setActiveStatus] = useState('PENDING'); // PENDING, ACCEPTED, COMPLETED
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');

    // Modal states
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [showAcceptModal, setShowAcceptModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [showCompleteModal, setShowCompleteModal] = useState(false);
    const [isQRScannerModalOpen, setIsQRScannerModalOpen] = useState(false);

    // Action Form states
    const [serviceType, setServiceType] = useState('');
    const [description, setDescription] = useState('');
    const [rejectReason, setRejectReason] = useState('');
    const [serviceResult, setServiceResult] = useState('');
    const [evidenceFiles, setEvidenceFiles] = useState([]);
    const [actionLoading, setActionLoading] = useState(false);

    const loadRequests = useCallback(async () => {
        if (!user?.tenantId) return;
        setLoading(true);
        setError('');
        try {
            const params = {
                status: activeStatus,
                page,
                size: 10,
                // name: searchQuery // If server supports name search on this endpoint
            };
            const result = await fetchReceivedServiceRequests(user.tenantId, params);
            if (result.success) {
                setRequests(result.data.content || []);
                setTotalPages(result.data.totalPages || 0);
            } else {
                setError(result.message || '데이터를 불러오지 못했습니다.');
            }
        } catch (e) {
            setError('요청 목록을 가져오는 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    }, [user?.tenantId, activeStatus, page, fetchReceivedServiceRequests]);

    useEffect(() => {
        loadRequests();
    }, [loadRequests]);

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            setEvidenceFiles(prev => [...prev, ...Array.from(e.target.files)]);
        }
    };

    const handleRemoveFile = (indexToRemove) => {
        setEvidenceFiles(prev => prev.filter((_, idx) => idx !== indexToRemove));
    };

    const uploadEvidences = async () => {
        if (evidenceFiles.length === 0) return null;

        let currentEvidenceGroupId = null;
        for (const file of evidenceFiles) {
            const presignRes = await presignServiceProviderEvidence(user.tenantId, {
                evidenceGroupId: currentEvidenceGroupId,
                fileName: file.name,
                contentType: file.type || 'application/octet-stream'
            });

            if (!presignRes.success) throw new Error(presignRes.message);
            const presignData = presignRes.data;
            currentEvidenceGroupId = presignData.evidenceGroupId;

            const uploadRes = await fetch(presignData.uploadUrl, {
                method: 'PUT',
                body: file,
                headers: { 'Content-Type': file.type || 'application/octet-stream' }
            });

            if (!uploadRes.ok) throw new Error(`실패: ${file.name} 업로드 실패`);

            const fileHash = await calculateSHA256(file);
            await completeServiceProviderEvidence(user.tenantId, {
                evidenceGroupId: currentEvidenceGroupId,
                evidenceId: presignData.evidenceId,
                sizeBytes: file.size,
                fileHash: fileHash
            });
        }
        return currentEvidenceGroupId;
    };

    const handleAccept = async () => {
        if (!serviceType) {
            alert('서비스 타입을 입력해주세요.');
            return;
        }
        setActionLoading(true);
        try {
            const evidenceGroupId = await uploadEvidences();

            const result = await acceptServiceRequest(user.tenantId, selectedRequest.serviceRequestId, {
                serviceType,
                description,
                beforeEvidenceGroupId: evidenceGroupId // Using beforeEvidenceGroupId based on docs
            });
            if (result.success) {
                setShowAcceptModal(false);
                resetActionStates();
                loadRequests();
            } else {
                alert(result.message);
            }
        } catch (e) {
            alert(`오류 발생: ${e.message}`);
        } finally {
            setActionLoading(false);
        }
    };

    const handleReject = async () => {
        if (!rejectReason) {
            alert('거절 사유를 입력해주세요.');
            return;
        }
        setActionLoading(true);
        try {
            const result = await rejectServiceRequest(user.tenantId, selectedRequest.serviceRequestId, rejectReason);
            if (result.success) {
                setShowRejectModal(false);
                resetActionStates();
                loadRequests();
            } else {
                alert(result.message);
            }
        } finally {
            setActionLoading(false);
        }
    };

    const handleComplete = async () => {
        if (!serviceResult) {
            alert('처리 결과 요약을 입력해주세요.');
            return;
        }
        setActionLoading(true);
        try {
            const evidenceGroupId = await uploadEvidences();

            const result = await completeServiceRequest(user.tenantId, selectedRequest.serviceRequestId, {
                serviceResult,
                afterEvidenceGroupId: evidenceGroupId
            });
            if (result.success) {
                setShowCompleteModal(false);
                resetActionStates();
                loadRequests();
            } else {
                alert(result.message);
            }
        } catch (e) {
            alert(`오류 발생: ${e.message}`);
        } finally {
            setActionLoading(false);
        }
    };

    const resetActionStates = () => {
        setSelectedRequest(null);
        setServiceType('');
        setDescription('');
        setRejectReason('');
        setServiceResult('');
        setEvidenceFiles([]);
    };

    const handleQRScanSuccess = (decodedText) => {
        setIsQRScannerModalOpen(false);

        // Extract passportId or serviceRequestId
        let passportId = decodedText;
        if (decodedText.includes('passports/')) {
            const parts = decodedText.split('passports/');
            if (parts.length > 1) {
                passportId = parts[1].split('/')[0];
            }
        }

        // Search in current pending requests
        const found = requests.find(r => r.passportId === passportId || r.serviceRequestId === decodedText);

        if (found) {
            setSelectedRequest(found);
            setShowAcceptModal(true);
        } else {
            alert("해당 제품 또는 요청을 접수 대기 목록에서 찾을 수 없습니다.");
        }
    };

    const StatusTab = ({ status, label, icon: Icon }) => (
        <button
            onClick={() => { setActiveStatus(status); setPage(0); }}
            className={`flex items-center gap-2 px-6 py-4 border-b-2 font-bold transition-all ${activeStatus === status
                ? 'border-amber-500 text-amber-600 bg-amber-50/30'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
        >
            <Icon size={18} />
            {label}
            {activeStatus === status && !loading && (
                <span className="ml-1 text-[11px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full">
                    {requests.length}
                </span>
            )}
        </button>
    );

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-gray-100">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Wrench className="text-amber-500" />
                        수신 요청 처리 (Inbox)
                    </h1>
                    <p className="text-gray-500 mt-1">고객들로부터 접수된 서비스 요청을 관리하고 처리합니다.</p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsQRScannerModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors shadow-lg shadow-amber-500/20"
                    >
                        <QrCode size={18} />
                        QR 접수
                    </button>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="시리얼 번호, 모델명 검색..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 w-64"
                        />
                        <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
                    </div>
                    <button className="p-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors">
                        <Filter size={18} />
                    </button>
                </div>
            </header>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden min-h-[500px] flex flex-col">
                <div className="flex border-b border-gray-200 overflow-x-auto bg-gray-50/50">
                    <StatusTab status="PENDING" label="접수 대기" icon={AlertCircle} />
                    <StatusTab status="ACCEPTED" label="진행 중" icon={Clock} />
                    <StatusTab status="COMPLETED" label="처리 완료" icon={CheckCircle2} />
                    <StatusTab status="REJECTED" label="거절 내역" icon={XCircle} />
                    <StatusTab status="CANCELLED" label="취소 내역" icon={XCircle} />
                </div>

                <div className="flex-1 overflow-x-auto">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center p-20 text-gray-400">
                            <Loader2 className="animate-spin mb-3" size={32} />
                            <p>요청 목록을 불러오고 있습니다...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center p-20 text-red-500">
                            <AlertCircle className="mb-3" size={40} />
                            <p className="font-medium">{error}</p>
                            <button onClick={loadRequests} className="mt-4 text-sm font-bold underline">다시 시도</button>
                        </div>
                    ) : requests.length > 0 ? (
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-xs font-bold text-gray-400 uppercase tracking-wider bg-gray-50/50">
                                    <th className="px-6 py-4">제품 / 모델 정보</th>
                                    <th className="px-6 py-4">서비스 유형 / 설명</th>
                                    <th className="px-6 py-4">신청 일자</th>
                                    <th className="px-6 py-4">상태</th>
                                    <th className="px-6 py-4 text-right">관리</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {requests.map((req) => (
                                    <tr key={req.serviceRequestId} className="hover:bg-gray-50/50 transition-colors group">
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                                    <Package size={20} />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-900">{req.modelName || '모델 정보 없음'}</div>
                                                    <div className="text-xs text-gray-500 font-mono mt-0.5">S/N: {req.serialNumber || '-'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="text-sm font-medium text-gray-700">{req.serviceType || '미지정'}</div>
                                            <p className="text-xs text-gray-400 mt-1 line-clamp-1 max-w-[200px]">{req.description || '-'}</p>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="text-sm text-gray-600 font-medium">
                                                {req.submittedAt ? new Date(req.submittedAt).toLocaleDateString() : '-'}
                                            </div>
                                            <div className="text-[10px] text-gray-400 mt-0.5">
                                                {req.submittedAt ? new Date(req.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full border ${req.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                                req.status === 'ACCEPTED' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                    req.status === 'COMPLETED' ? 'bg-green-50 text-green-700 border-green-100' :
                                                        'bg-gray-50 text-gray-500 border-gray-100'
                                                }`}>
                                                {req.status === 'PENDING' ? '접수대기' :
                                                    req.status === 'ACCEPTED' ? '진행중' :
                                                        req.status === 'COMPLETED' ? '처리완료' : req.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {req.status === 'PENDING' && (
                                                    <>
                                                        <button
                                                            onClick={() => { setSelectedRequest(req); setShowAcceptModal(true); }}
                                                            className="px-3 py-1.5 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 transition-colors"
                                                        >
                                                            접수하기
                                                        </button>
                                                        <button
                                                            onClick={() => { setSelectedRequest(req); setShowRejectModal(true); }}
                                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                        >
                                                            <XCircle size={18} />
                                                        </button>
                                                    </>
                                                )}
                                                {req.status === 'ACCEPTED' && (
                                                    <button
                                                        onClick={() => { setSelectedRequest(req); setShowCompleteModal(true); }}
                                                        className="px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 transition-colors"
                                                    >
                                                        작업 완료
                                                    </button>
                                                )}
                                                <button className="p-1.5 text-gray-300 hover:text-gray-600 transition-colors">
                                                    <ChevronRight size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="flex flex-col items-center justify-center p-32 text-gray-400">
                            <div className="p-4 bg-gray-50 rounded-full mb-4">
                                <ClipboardList size={48} className="text-gray-200" />
                            </div>
                            <p className="font-medium">접수된 서비스 요청이 없습니다.</p>
                            <p className="text-sm mt-1">상태 필터를 변경하거나 잠시 후 다시 확인해주세요.</p>
                        </div>
                    )}
                </div>

                {totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-center gap-4 bg-gray-50/30">
                        <button
                            disabled={page === 0}
                            onClick={() => setPage(page - 1)}
                            className="p-2 border border-gray-200 rounded-lg disabled:opacity-30 hover:bg-white transition-colors"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <span className="text-sm font-bold text-gray-600">
                            {page + 1} / {totalPages}
                        </span>
                        <button
                            disabled={page >= totalPages - 1}
                            onClick={() => setPage(page + 1)}
                            className="p-2 border border-gray-200 rounded-lg disabled:opacity-30 hover:bg-white transition-colors"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                )}
            </div>

            {/* Accept Modal */}
            {showAcceptModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl p-8 max-w-xl w-full shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-100 text-amber-600 rounded-xl">
                                    <FileText size={24} />
                                </div>
                                <h2 className="text-xl font-bold text-gray-900">서비스 요청 접수</h2>
                            </div>
                            <button onClick={() => { setShowAcceptModal(false); resetActionStates(); }} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">접수 제품 정보</div>
                                <div className="font-bold text-gray-900">{selectedRequest?.modelName}</div>
                                <div className="text-sm text-gray-600 mt-1">S/N: {selectedRequest?.serialNumber}</div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">서비스 타입 <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        placeholder="예: 정기 점검, 수리"
                                        value={serviceType}
                                        onChange={(e) => setServiceType(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">작업 상세 내용 (선택)</label>
                                    <input
                                        type="text"
                                        placeholder="간략한 작업 계획"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">작업 전 증빙 사진 (Evidence) <span className="text-red-500">*</span></label>
                                <div className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl transition-all ${evidenceFiles.length > 0 ? 'border-amber-200 bg-amber-50/10' : 'border-gray-200 bg-gray-50 hover:border-amber-300'}`}>
                                    {evidenceFiles.length > 0 ? (
                                        <div className="w-full space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-gray-500">{evidenceFiles.length}개 파일 선택됨</span>
                                                <label className="text-xs font-bold text-amber-600 hover:underline cursor-pointer">
                                                    파일 추가
                                                    <input type="file" multiple className="sr-only" onChange={handleFileChange} accept="image/*" />
                                                </label>
                                            </div>
                                            <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
                                                {evidenceFiles.map((f, i) => (
                                                    <div key={i} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl shadow-sm">
                                                        <div className="flex items-center gap-2 overflow-hidden">
                                                            <FileText size={16} className="text-amber-500" />
                                                            <span className="text-sm text-gray-700 truncate">{f.name}</span>
                                                        </div>
                                                        <button onClick={() => handleRemoveFile(i)} className="text-gray-400 hover:text-red-500 transition-colors">
                                                            <X size={16} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <label className="flex flex-col items-center gap-2 cursor-pointer w-full py-4">
                                            <UploadCloud size={32} className="text-gray-300" />
                                            <span className="text-sm font-bold text-gray-500">사진을 업로드하세요</span>
                                            <span className="text-[10px] text-gray-400">이미지 파일 (최대 10MB)</span>
                                            <input type="file" multiple className="sr-only" onChange={handleFileChange} accept="image/*" />
                                        </label>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={() => { setShowAcceptModal(false); resetActionStates(); }}
                                className="flex-1 py-3.5 text-gray-500 font-bold hover:bg-gray-100 rounded-2xl transition-all"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleAccept}
                                disabled={actionLoading || evidenceFiles.length === 0}
                                className="flex-1 py-3.5 bg-amber-500 text-white font-bold rounded-2xl shadow-lg shadow-amber-500/30 hover:bg-amber-600 transition-all flex items-center justify-center disabled:opacity-50"
                            >
                                {actionLoading ? <Loader2 className="animate-spin" size={20} /> : '접수 완료'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reject Modal */}
            {showRejectModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-red-100 text-red-600 rounded-xl">
                                <AlertCircle size={24} />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900">요청 거절</h2>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1.5">거절 사유 <span className="text-red-500">*</span></label>
                            <textarea
                                rows={4}
                                placeholder="고객에게 전달할 거절 사유를 입력하세요."
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20"
                            />
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={() => { setShowRejectModal(false); resetActionStates(); }}
                                className="flex-1 py-3.5 text-gray-500 font-bold hover:bg-gray-100 rounded-2xl transition-all"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleReject}
                                disabled={actionLoading}
                                className="flex-1 py-3.5 bg-red-500 text-white font-bold rounded-2xl shadow-lg shadow-red-500/30 hover:bg-red-600 transition-all flex items-center justify-center"
                            >
                                {actionLoading ? <Loader2 className="animate-spin" size={20} /> : '거절 처리'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Complete Modal */}
            {showCompleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl p-8 max-w-xl w-full shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-100 text-green-600 rounded-xl">
                                    <CheckCircle2 size={24} />
                                </div>
                                <h2 className="text-xl font-bold text-gray-900">서비스 작업 완료</h2>
                            </div>
                            <button onClick={() => { setShowCompleteModal(false); resetActionStates(); }} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">처리 결과 요약 <span className="text-red-500">*</span></label>
                                <textarea
                                    rows={4}
                                    placeholder="작업 완료 내용을 상세히 입력하세요."
                                    value={serviceResult}
                                    onChange={(e) => setServiceResult(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">작업 후 증빙 사진 (Evidence) <span className="text-red-500">*</span></label>
                                <div className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl transition-all ${evidenceFiles.length > 0 ? 'border-green-200 bg-green-50/10' : 'border-gray-200 bg-gray-50 hover:border-green-300'}`}>
                                    {evidenceFiles.length > 0 ? (
                                        <div className="w-full space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-gray-500">{evidenceFiles.length}개 파일 선택됨</span>
                                                <label className="text-xs font-bold text-green-600 hover:underline cursor-pointer">
                                                    파일 추가
                                                    <input type="file" multiple className="sr-only" onChange={handleFileChange} accept="image/*" />
                                                </label>
                                            </div>
                                            <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
                                                {evidenceFiles.map((f, i) => (
                                                    <div key={i} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl shadow-sm">
                                                        <div className="flex items-center gap-2 overflow-hidden">
                                                            <FileText size={16} className="text-green-500" />
                                                            <span className="text-sm text-gray-700 truncate">{f.name}</span>
                                                        </div>
                                                        <button onClick={() => handleRemoveFile(i)} className="text-gray-400 hover:text-red-500 transition-colors">
                                                            <X size={16} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <label className="flex flex-col items-center gap-2 cursor-pointer w-full py-4">
                                            <UploadCloud size={32} className="text-gray-300" />
                                            <span className="text-sm font-bold text-gray-500">최종 작업 증빙 사진을 업로드하세요</span>
                                            <input type="file" multiple className="sr-only" onChange={handleFileChange} accept="image/*" />
                                        </label>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={() => { setShowCompleteModal(false); resetActionStates(); }}
                                className="flex-1 py-3.5 text-gray-500 font-bold hover:bg-gray-100 rounded-2xl transition-all"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleComplete}
                                disabled={actionLoading || evidenceFiles.length === 0}
                                className="flex-1 py-3.5 bg-green-600 text-white font-bold rounded-2xl shadow-lg shadow-green-600/30 hover:bg-green-700 transition-all flex items-center justify-center disabled:opacity-50"
                            >
                                {actionLoading ? <Loader2 className="animate-spin" size={20} /> : '최종 완료 처리'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <WhiteScannerModal
                isOpen={isQRScannerModalOpen}
                onClose={() => setIsQRScannerModalOpen(false)}
                onScan={handleQRScanSuccess}
                variant="service"
                title="제품 QR 스캔 접수"
                description="수리 또는 점검이 필요한 제품의 QR 코드를 스캔하세요."
                status="스캔이 완료되면 자동으로 접수 정보가 확인됩니다."
            />
        </div>
    );
};

export default ServiceRequests;
