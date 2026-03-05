import React, { useState } from 'react';
import useAuthStore from '../../store/useAuthStore';
import { Check, X, Clock, ShieldAlert } from 'lucide-react';

const PlatformAdminView = () => {
    const { applications, listApplications, approveApplication, rejectApplication } = useAuthStore();
    const [loading, setLoading] = useState(true);

    React.useEffect(() => {
        const fetchApps = async () => {
            setLoading(true);
            await listApplications();
            setLoading(false);
        };
        fetchApps();
    }, []);

    const handleProcess = async (id, status, type) => {
        setLoading(true);
        try {
            const result = status === 'APPROVED'
                ? await approveApplication(id, type)
                : await rejectApplication(id);

            if (!result.success) {
                alert(result.message || '처리에 실패했습니다.');
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
        <div className="space-y-6 animate-in fade-in duration-500">
            <header className="flex justify-between items-center pb-4 border-b border-gray-200">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">플랫폼 관리자 (Platform Admin)</h1>
                    <p className="text-gray-500 mt-1">시스템 전역 설정 및 파트너(업체) 합류 신청을 관리합니다.</p>
                </div>
            </header>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 justify-between rounded-xl border border-gray-200 shadow-sm flex items-center">
                    <div>
                        <div className="text-gray-500 text-sm font-medium">대기 중인 신청</div>
                        <div className="text-2xl font-bold text-gray-900 mt-1">{pendingApps.length}건</div>
                    </div>
                    <div className="w-10 h-10 bg-yellow-50 text-yellow-600 rounded-full flex items-center justify-center">
                        <Clock size={20} />
                    </div>
                </div>
                <div className="bg-white p-4 justify-between rounded-xl border border-gray-200 shadow-sm flex items-center">
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
                    <div className="overflow-x-auto">
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
                                    <tr key={app.applicationId} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 font-bold text-gray-900">{app.orgName}</td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-semibold">
                                                {app.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-gray-900">{app.bizRegNo || app.applicationId}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => handleDownload(app.evidenceDownloadUrl)}
                                                className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:text-gray-400"
                                                disabled={!app.evidenceDownloadUrl}
                                            >
                                                {app.evidenceOriginalFileName ? `${app.evidenceOriginalFileName} 다운로드` : 'PDF 다운로드'}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 text-xs rounded-full font-medium ${app.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                                                app.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                                    'bg-red-100 text-red-700'
                                                }`}>
                                                {app.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {app.status === 'PENDING' ? (
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleProcess(app.applicationId, 'APPROVED', app.type)}
                                                        className="flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50"
                                                        disabled={loading}
                                                    >
                                                        <Check size={14} /> 승인
                                                    </button>
                                                    <button
                                                        onClick={() => handleProcess(app.applicationId, 'REJECTED', app.type)}
                                                        className="flex items-center gap-1 bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50"
                                                        disabled={loading}
                                                    >
                                                        <X size={14} /> 반려
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-gray-400 text-xs">처리 완료됨</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PlatformAdminView;
