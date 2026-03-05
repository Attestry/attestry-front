import React from 'react';
import { ClipboardList, Wrench, FileCheck, CheckCircle2, Search } from 'lucide-react';
import useAuthStore, { ROLE_THEMES } from '../../store/useAuthStore';

const ServiceView = () => {
    const { user } = useAuthStore();
    const theme = ROLE_THEMES[user.role];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <header className="flex justify-between items-center pb-4 border-b border-gray-200">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">서비스 대시보드</h1>
                    <p className="text-gray-500 mt-1">제품 수리, 세탁 등 대고객 서비스 내역을 DPP에 기록합니다.</p>
                </div>
                <button
                    className="flex items-center gap-2 px-4 py-2 text-white rounded-md font-medium shadow-sm transition-opacity hover:opacity-90"
                    style={{ backgroundColor: theme.primary }}
                >
                    <CheckCircle2 size={18} />
                    신규 접수 등록
                </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-start gap-4">
                    <div className="p-3 rounded-lg" style={{ backgroundColor: theme.bg, color: theme.primary }}>
                        <ClipboardList size={24} />
                    </div>
                    <div>
                        <div className="text-gray-500 text-sm font-medium">대기 중인 요청</div>
                        <div className="text-2xl font-bold text-gray-900 mt-1">12</div>
                        <div className="text-xs text-red-500 font-medium mt-1">긴급 2건 포함</div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-start gap-4">
                    <div className="p-3 rounded-lg" style={{ backgroundColor: theme.bg, color: theme.primary }}>
                        <Wrench size={24} />
                    </div>
                    <div>
                        <div className="text-gray-500 text-sm font-medium">진행 중 상태</div>
                        <div className="text-2xl font-bold text-gray-900 mt-1">8</div>
                        <div className="text-xs text-teal-600 font-medium mt-1">센터 수리 진행중</div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-start gap-4">
                    <div className="p-3 rounded-lg" style={{ backgroundColor: theme.bg, color: theme.primary }}>
                        <FileCheck size={24} />
                    </div>
                    <div>
                        <div className="text-gray-500 text-sm font-medium">완료 및 이력 갱신</div>
                        <div className="text-2xl font-bold text-gray-900 mt-1">342</div>
                        <div className="text-xs text-green-600 font-medium mt-1">이번 달 누적</div>
                    </div>
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm mt-8">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                    <h2 className="font-bold text-lg text-gray-800">서비스 처리 현황</h2>
                    <div className="relative w-64">
                        <input
                            type="text"
                            placeholder="접수번호, 고객명 검색"
                            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1"
                            style={{ focusRingColor: theme.primary }}
                        />
                        <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 text-gray-500 text-sm">
                                <th className="px-6 py-3 font-medium">접수 번호</th>
                                <th className="px-6 py-3 font-medium">대상 시리얼 / 모델</th>
                                <th className="px-6 py-3 font-medium">서비스 유형</th>
                                <th className="px-6 py-3 font-medium">상태</th>
                                <th className="px-6 py-3 font-medium">액션</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-gray-200">
                            <tr className="hover:bg-gray-50">
                                <td className="px-6 py-4 font-medium text-gray-900">SRV-2026-0042</td>
                                <td className="px-6 py-4">
                                    <div className="font-medium text-gray-900">SN-2023-001X</div>
                                    <div className="text-xs text-gray-500">Premium Cotton T-shirt</div>
                                </td>
                                <td className="px-6 py-4 text-gray-700">프리미엄 세탁</td>
                                <td className="px-6 py-4"><span className="px-2 py-1 text-xs rounded-full bg-yellow-50 text-yellow-600 font-medium">대기중</span></td>
                                <td className="px-6 py-4"><button className="text-teal-600 hover:underline font-medium">작업 시작</button></td>
                            </tr>
                            <tr className="hover:bg-gray-50">
                                <td className="px-6 py-4 font-medium text-gray-900">SRV-2026-0041</td>
                                <td className="px-6 py-4">
                                    <div className="font-medium text-gray-900">SN-BAG-992X</div>
                                    <div className="text-xs text-gray-500">Classic Leather Bag</div>
                                </td>
                                <td className="px-6 py-4 text-gray-700">가죽 복원 수리</td>
                                <td className="px-6 py-4"><span className="px-2 py-1 text-xs rounded-full bg-blue-50 text-blue-600 font-medium">진행중</span></td>
                                <td className="px-6 py-4"><button className="text-teal-600 hover:underline font-medium">처리 내역 업데이트</button></td>
                            </tr>
                            <tr className="hover:bg-gray-50">
                                <td className="px-6 py-4 font-medium text-gray-900">SRV-2026-0038</td>
                                <td className="px-6 py-4">
                                    <div className="font-medium text-gray-900">SN-COT-881Y</div>
                                    <div className="text-xs text-gray-500">Wool Blend Coat</div>
                                </td>
                                <td className="px-6 py-4 text-gray-700">부자재 교체</td>
                                <td className="px-6 py-4"><span className="px-2 py-1 text-xs rounded-full bg-green-50 text-green-600 font-medium">완료 (DPP 갱신됨)</span></td>
                                <td className="px-6 py-4"><button className="text-gray-500 hover:text-gray-900 font-medium">블록체인 기록 보기</button></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ServiceView;
