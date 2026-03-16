import React, { useState } from 'react';
import useAuthStore from '../../store/useAuthStore';
import { Check, X, Clock, ShieldAlert, FileText, Download } from 'lucide-react';

const PlatformAdminView = () => {
    const { applications, listApplications, getAdminApplication, approveApplication, rejectApplication } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [selectedApp, setSelectedApp] = useState(null);
    const [appDetailLoading, setAppDetailLoading] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [showRejectInput, setShowRejectInput] = useState(false);

    React.useEffect(() => {
        const fetchApps = async () => {
            setLoading(true);
            await listApplications();
            setLoading(false);
        };
        fetchApps();
    }, []);

    const handleAppClick = async (appId) => {
        setAppDetailLoading(true);
        setSelectedApp({ applicationId: appId });
        setShowRejectInput(false);
        setRejectReason('');
        const res = await getAdminApplication(appId);
        if (res.success && res.data) {
            setSelectedApp(res.data);
        }
        setAppDetailLoading(false);
    };

    const handleProcess = async (id, status, type) => {
        if (status === 'REJECTED' && !rejectReason.trim()) {
            alert('반려 사유를 입력해주세요.');
            return;
        }

        setLoading(true);
        try {
            const result = status === 'APPROVED'
                ? await approveApplication(id, type)
                : await rejectApplication(id, rejectReason);

            if (!result.success) {
                alert(result.message || '처리에 실패했습니다.');
            } else {
                setSelectedApp(null);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = (url) => {
        if (!url) return;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const pendingApps = applications.filter(app => app.status === 'PENDING');
    const processedApps = applications.filter(app => app.status !== 'PENDING');

    return (
        <>
            <div className="space-y-6 animate-in fade-in duration-500">
                <header className="flex flex-col gap-3 pb-4 border-b border-gray-200 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">플랫폼 관리자 (Platform Admin)</h1>
                        <p className="text-gray-500 mt-1">시스템 전역 설정 및 파트너(업체) 합류 신청을 관리합니다.</p>
                    </div>
                </header>

                {/* Stats */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <div className="bg-white p-4 justify-between rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
                        <div>
                            <div className="text-gray-500 text-sm font-medium">대기 중인 신청</div>
                            <div className="text-2xl font-bold text-gray-900 mt-1">{pendingApps.length}건</div>
                        </div>
                        <div className="w-10 h-10 bg-yellow-50 text-yellow-600 rounded-full flex items-center justify-center">
                            <Clock size={20} />
                        </div>
                    </div>
                    <div className="bg-white p-4 justify-between rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
                        <div>
                            <div className="text-gray-500 text-sm font-medium">오늘 승인됨</div>
                            <div className="text-2xl font-bold text-gray-900 mt-1">
                                {processedApps.filter(a => a.status === 'APPROVED').length}건
                            </div>
                        </div>
                        <div className="w-10 h-10 bg-green-50 text-green-600 rounded-full flex items-center justify-center">
                            <Check size={20} />
                        </div>
                    </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm mt-8">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h2 className="font-bold text-lg text-gray-800">업체 파트너십 승인 대기열 (Onboarding Queue)</h2>
                    </div>

                    {loading ? (
                        <div className="p-20 text-center text-gray-500 flex flex-col items-center">
                            <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mb-4" />
                            <p>데이터를 불러오는 중...</p>
                        </div>
                    ) : applications.length === 0 ? (
                        <div className="p-10 text-center text-gray-500 flex flex-col items-center">
                            <ShieldAlert size={40} className="mb-3 opacity-20" />
                            <p>접수된 신청 내역이 없습니다.</p>
                            <p className="text-sm mt-1">일반 회원 상태에서 '업체 신청'을 통해 테스트해보세요.</p>
                        </div>
                    ) : (
                        <>
                            <div className="divide-y divide-gray-200 md:hidden">
                                {applications.map((app) => (
                                    <button
                                        key={app.applicationId}
                                        type="button"
                                        className="w-full space-y-3 px-4 py-4 text-left transition-colors hover:bg-gray-50"
                                        onClick={() => handleAppClick(app.applicationId)}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="font-bold text-gray-900 break-words">{app.orgName}</div>
                                                <div className="mt-1 break-all text-xs text-gray-500">
                                                    {app.bizRegNo || app.applicationId}
                                                </div>
                                            </div>
                                            <span className={`shrink-0 px-2 py-1 text-xs rounded-full font-medium ${app.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                                                app.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                                    'bg-red-100 text-red-700'
                                                }`}>
                                                {app.status}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                            <span className="rounded-full bg-gray-100 px-2 py-1 font-semibold text-gray-700">
                                                {app.type}
                                            </span>
                                            <span>
                                                {app.evidenceFiles && app.evidenceFiles.length > 0
                                                    ? `${app.evidenceFiles.length}개 첨부됨`
                                                    : app.evidenceDownloadUrl
                                                        ? '첨부됨'
                                                        : '첨부 없음'}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                            <div className="hidden overflow-x-auto md:block">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 text-gray-500 text-sm">
                                        <th className="px-6 py-3 font-medium">상호명</th>
                                        <th className="px-6 py-3 font-medium">유형</th>
                                        <th className="px-6 py-3 font-medium">식별번호</th>
                                        <th className="px-6 py-3 font-medium">증빙 파일</th>
                                        <th className="px-6 py-3 font-medium">상태</th>
                                        <th className="px-6 py-3 font-medium text-right">심사 액션</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm divide-y divide-gray-200">
                                    {applications.map((app) => (
                                        <tr
                                            key={app.applicationId}
                                            className="hover:bg-gray-50 cursor-pointer transition-colors"
                                            onClick={() => handleAppClick(app.applicationId)}
                                        >
                                            <td className="px-6 py-4 font-bold text-gray-900">{app.orgName}</td>
                                            <td className="px-6 py-4">
                                                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-semibold">
                                                    {app.type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-900">
                                                {app.bizRegNo || app.applicationId}
                                            </td>
                                            <td className="px-6 py-4">
                                                {app.evidenceFiles && app.evidenceFiles.length > 0 ? (
                                                    <span className="text-xs font-medium text-blue-600 flex items-center gap-1">
                                                        <FileText size={14} /> {app.evidenceFiles.length}개 첨부됨
                                                    </span>
                                                ) : app.evidenceDownloadUrl ? (
                                                    <span className="text-xs font-medium text-blue-600 flex items-center gap-1">
                                                        <FileText size={14} /> 첨부됨
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-gray-400">없음</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 text-xs rounded-full font-medium ${app.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                                                    app.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                                        'bg-red-100 text-red-700'
                                                    }`}>
                                                    {app.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right text-gray-400 text-xs">
                                                상세 보기 &rarr;
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Application Detail Modal */}
            {selectedApp && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
                        <div className="sticky top-0 bg-white border-b border-gray-100 flex justify-between items-center px-6 py-4 z-10">
                            <h3 className="text-lg font-bold text-gray-900">신청내역 상세조회</h3>
                            <button onClick={() => setSelectedApp(null)} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>
                        {appDetailLoading || !selectedApp.orgName ? (
                            <div className="p-12 text-center text-gray-500 flex flex-col items-center">
                                <div className="w-8 h-8 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin mb-3" />
                                <p>상세 정보를 불러오는 중...</p>
                            </div>
                        ) : (
                            <div className="p-6 space-y-6">
                                <div className="space-y-4">
                                    <div>
                                        <div className="text-xs text-gray-500 mb-1">상호명 (Organization Name)</div>
                                        <div className="font-semibold text-gray-900">{selectedApp.orgName}</div>
                                    </div>
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <div>
                                            <div className="text-xs text-gray-500 mb-1">유형 (Type)</div>
                                            <div className="inline-flex px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-semibold">
                                                {selectedApp.type}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-gray-500 mb-1">국가 (Country)</div>
                                            <div className="text-gray-900">{selectedApp.country}</div>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-500 mb-1">식별번호 (Biz Reg No.)</div>
                                        <div className="text-gray-900">{selectedApp.bizRegNo || '-'}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-500 mb-1">상태 (Status)</div>
                                        <span className={`px-2 py-1 text-xs rounded-full font-medium ${selectedApp.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                                            selectedApp.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                                'bg-red-100 text-red-700'
                                            }`}>
                                            {selectedApp.status}
                                        </span>
                                    </div>
                                    {selectedApp.status === 'REJECTED' && selectedApp.rejectReason && (
                                        <div className="bg-red-50 p-3 rounded-lg border border-red-100 text-red-700 text-sm">
                                            <strong>반려 사유:</strong> {selectedApp.rejectReason}
                                        </div>
                                    )}
                                    {(selectedApp.evidenceFiles || selectedApp.evidenceDownloadUrl) && (
                                        <div className="pt-2">
                                            <div className="text-xs text-gray-500 mb-2">제출된 증빙 서류</div>
                                            <div className="space-y-2">
                                                {selectedApp.evidenceFiles && selectedApp.evidenceFiles.length > 0 ? (
                                                    selectedApp.evidenceFiles.map((file, idx) => (
                                                        <button
                                                            key={file.evidenceFileId || idx}
                                                            onClick={() => handleDownload(file.downloadUrl)}
                                                            className="flex items-center justify-between w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm transition-colors hover:bg-gray-100 group"
                                                        >
                                                            <div className="flex items-center gap-2 overflow-hidden mr-2">
                                                                <FileText size={16} className="text-gray-400 shrink-0" />
                                                                <span className="truncate text-gray-700 font-medium">{file.originalFileName}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                <span className="text-xs text-gray-400">{(file.sizeBytes / 1024 / 1024).toFixed(2)} MB</span>
                                                                <Download size={14} className="text-gray-400 group-hover:text-blue-600 transition-colors" />
                                                            </div>
                                                        </button>
                                                    ))
                                                ) : (
                                                    // Fallback for older single-file data structure
                                                    <button
                                                        onClick={() => handleDownload(selectedApp.evidenceDownloadUrl)}
                                                        className="flex items-center justify-between w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm transition-colors hover:bg-gray-100 group"
                                                    >
                                                        <div className="flex items-center gap-2 overflow-hidden mr-2">
                                                            <FileText size={16} className="text-gray-400 shrink-0" />
                                                            <span className="truncate text-gray-700 font-medium">{selectedApp.evidenceOriginalFileName || '증빙서류'}</span>
                                                        </div>
                                                        <Download size={14} className="text-gray-400 group-hover:text-blue-600 transition-colors" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-4 border-t border-gray-100">
                                    {selectedApp.status === 'PENDING' ? (
                                        showRejectInput ? (
                                            <div className="space-y-3">
                                                <label className="block text-sm font-medium text-gray-700">반려 사유 (필수)</label>
                                                <textarea
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                                                    rows="3"
                                                    value={rejectReason}
                                                    onChange={(e) => setRejectReason(e.target.value)}
                                                    placeholder="업체에게 전달될 반려 사유를 상세히 적어주세요."
                                                ></textarea>
                                                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                                    <button
                                                        onClick={() => {
                                                            setShowRejectInput(false);
                                                            setRejectReason('');
                                                        }}
                                                        className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                                                    >
                                                        취소
                                                    </button>
                                                    <button
                                                        onClick={() => handleProcess(selectedApp.applicationId, 'REJECTED', selectedApp.type)}
                                                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                                                        disabled={loading || !rejectReason.trim()}
                                                    >
                                                        {loading ? '처리중...' : '최종 반려 구별'}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-2 w-full sm:flex-row">
                                                <button
                                                    onClick={() => setShowRejectInput(true)}
                                                    className="flex-1 py-2.5 text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg font-medium transition-colors"
                                                    disabled={loading}
                                                >
                                                    선택 반려
                                                </button>
                                                <button
                                                    onClick={() => handleProcess(selectedApp.applicationId, 'APPROVED', selectedApp.type)}
                                                    className="flex-1 py-2.5 text-white bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors"
                                                    disabled={loading}
                                                >
                                                    {loading ? '처리중...' : '신청 승인'}
                                                </button>
                                            </div>
                                        )
                                    ) : (
                                        <button
                                            onClick={() => setSelectedApp(null)}
                                            className="w-full py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                                        >
                                            닫기
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default PlatformAdminView;
