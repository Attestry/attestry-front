import React from 'react';
import { Tag, PackageCheck, Briefcase, Plus, Search } from 'lucide-react';
import useAuthStore, { ROLE_THEMES } from '../../store/useAuthStore';

const BrandView = () => {
    const { user } = useAuthStore();
    const theme = ROLE_THEMES[user.role];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <header className="flex justify-between items-center pb-4 border-b border-gray-200">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">브랜드 대시보드</h1>
                    <p className="text-gray-500 mt-1">제품 등록(Mint) 및 출고 등을 관리합니다.</p>
                </div>
                <button
                    className="flex items-center gap-2 px-4 py-2 text-white rounded-md font-medium shadow-sm transition-opacity hover:opacity-90"
                    style={{ backgroundColor: theme.primary }}
                >
                    <Plus size={18} />
                    새 DPP 발행 (Mint)
                </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-start gap-4">
                    <div className="p-3 rounded-lg" style={{ backgroundColor: theme.bg, color: theme.primary }}>
                        <Tag size={24} />
                    </div>
                    <div>
                        <div className="text-gray-500 text-sm font-medium">총 발행된 DPP</div>
                        <div className="text-2xl font-bold text-gray-900 mt-1">1,245</div>
                        <div className="text-xs text-green-600 font-medium mt-1">+12% 이번 달</div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-start gap-4">
                    <div className="p-3 rounded-lg" style={{ backgroundColor: theme.bg, color: theme.primary }}>
                        <PackageCheck size={24} />
                    </div>
                    <div>
                        <div className="text-gray-500 text-sm font-medium">출고 대기 (Release)</div>
                        <div className="text-2xl font-bold text-gray-900 mt-1">84</div>
                        <div className="text-xs text-gray-400 font-medium mt-1">리테일러 할당 전</div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-start gap-4">
                    <div className="p-3 rounded-lg" style={{ backgroundColor: theme.bg, color: theme.primary }}>
                        <Briefcase size={24} />
                    </div>
                    <div>
                        <div className="text-gray-500 text-sm font-medium">협력사 조회</div>
                        <div className="text-2xl font-bold text-gray-900 mt-1">32</div>
                        <div className="text-xs text-blue-600 font-medium mt-1">승인된 파트너</div>
                    </div>
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm mt-8">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                    <h2 className="font-bold text-lg text-gray-800">최근 발행된 디지털 상품</h2>
                    <div className="relative w-64">
                        <input
                            type="text"
                            placeholder="제품명, 시리얼 검색"
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
                                <th className="px-6 py-3 font-medium">상품 모델</th>
                                <th className="px-6 py-3 font-medium">시리얼 라벨</th>
                                <th className="px-6 py-3 font-medium">발행일</th>
                                <th className="px-6 py-3 font-medium">상태</th>
                                <th className="px-6 py-3 font-medium">관리</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-gray-200">
                            <tr className="hover:bg-gray-50">
                                <td className="px-6 py-4 font-medium text-gray-900">Premium Cotton T-shirt</td>
                                <td className="px-6 py-4 text-gray-500">SN-2023-001X</td>
                                <td className="px-6 py-4 text-gray-500">2026.03.05</td>
                                <td className="px-6 py-4"><span className="px-2 py-1 text-xs rounded-full bg-blue-50 text-blue-600 font-medium">발행 완료</span></td>
                                <td className="px-6 py-4"><button className="text-blue-600 hover:underline font-medium">상세보기</button></td>
                            </tr>
                            <tr className="hover:bg-gray-50">
                                <td className="px-6 py-4 font-medium text-gray-900">Eco-Friendly Denim Jacket</td>
                                <td className="px-6 py-4 text-gray-500">SN-2023-002Y</td>
                                <td className="px-6 py-4 text-gray-500">2026.03.04</td>
                                <td className="px-6 py-4"><span className="px-2 py-1 text-xs rounded-full bg-blue-50 text-blue-600 font-medium">발행 완료</span></td>
                                <td className="px-6 py-4"><button className="text-blue-600 hover:underline font-medium">상세보기</button></td>
                            </tr>
                            <tr className="hover:bg-gray-50">
                                <td className="px-6 py-4 font-medium text-gray-900">Limited Edition Sneakers</td>
                                <td className="px-6 py-4 text-gray-500">SN-2023-003Z</td>
                                <td className="px-6 py-4 text-gray-500">2026.03.02</td>
                                <td className="px-6 py-4"><span className="px-2 py-1 text-xs rounded-full bg-green-50 text-green-600 font-medium">리테일 출고</span></td>
                                <td className="px-6 py-4"><button className="text-blue-600 hover:underline font-medium">상세보기</button></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default BrandView;
