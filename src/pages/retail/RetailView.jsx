import React from 'react';
import { PackageCheck, RefreshCw, Users, Search, ScanLine } from 'lucide-react';
import useAuthStore, { ROLE_THEMES } from '../../store/useAuthStore';

const RetailView = () => {
    const { user } = useAuthStore();
    const theme = ROLE_THEMES[user.role];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <header className="flex flex-col gap-4 rounded-[1.75rem] border border-gray-200 bg-white px-6 py-6 shadow-sm md:flex-row md:items-center md:justify-between">
                <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: theme.primary }}>Retail profile</div>
                    <h1 className="mt-2 text-2xl font-bold text-gray-900">리테일 대시보드</h1>
                    <p className="mt-1 text-gray-500">보유 제품 관리와 고객 소유권 이전 흐름을 운영합니다.</p>
                </div>
                <button
                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-white font-medium shadow-sm transition-all hover:-translate-y-0.5"
                    style={{ backgroundColor: theme.primary }}
                >
                    <ScanLine size={18} />
                    바코드/QR 스캔 (입고)
                </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-[1.5rem] border border-gray-200 shadow-sm flex items-start gap-4">
                    <div className="p-3 rounded-xl" style={{ backgroundColor: theme.bg, color: theme.primary }}>
                        <PackageCheck size={24} />
                    </div>
                    <div>
                        <div className="text-gray-500 text-sm font-medium">현재 보유 재고</div>
                        <div className="text-2xl font-bold text-gray-900 mt-1">452</div>
                        <div className="text-xs font-medium mt-1" style={{ color: theme.primary }}>3개 지점 합산</div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-[1.5rem] border border-gray-200 shadow-sm flex items-start gap-4">
                    <div className="p-3 rounded-xl" style={{ backgroundColor: theme.bg, color: theme.primary }}>
                        <RefreshCw size={24} />
                    </div>
                    <div>
                        <div className="text-gray-500 text-sm font-medium">소유권 이전 완료</div>
                        <div className="text-2xl font-bold text-gray-900 mt-1">1,028</div>
                        <div className="text-xs text-green-600 font-medium mt-1">+45건 이번 주</div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-[1.5rem] border border-gray-200 shadow-sm flex items-start gap-4">
                    <div className="p-3 rounded-xl" style={{ backgroundColor: theme.bg, color: theme.primary }}>
                        <Users size={24} />
                    </div>
                    <div>
                        <div className="text-gray-500 text-sm font-medium">고객 등록율</div>
                        <div className="text-2xl font-bold text-gray-900 mt-1">84.2%</div>
                        <div className="text-xs font-medium mt-1" style={{ color: theme.primary }}>판매 대비</div>
                    </div>
                </div>
            </div>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="bg-white border border-gray-200 rounded-[1.5rem] overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-gray-200 flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
                        <div>
                            <h2 className="font-bold text-lg text-gray-800">최근 판매 및 소유권 이전 내역</h2>
                            <p className="mt-1 text-sm text-gray-500">최근 판매된 제품의 이전 상태를 빠르게 확인할 수 있습니다.</p>
                        </div>
                        <div className="relative w-full md:w-64">
                        <input
                            type="text"
                            placeholder="주문번호, 고객명 검색"
                            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1"
                            style={{ focusRingColor: theme.primary }}
                        />
                        <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                    </div>
                </div>
                    <div className="divide-y divide-gray-100 md:hidden">
                        {[
                            {
                                soldAt: '2026.03.05 14:30',
                                product: 'Limited Edition Sneakers',
                                serial: 'SN-2023-003Z',
                                status: '이전 완료',
                                statusClass: 'bg-green-50 text-green-600',
                                action: '증명서 보기',
                                actionStyle: { color: theme.primary },
                            },
                            {
                                soldAt: '2026.03.05 11:15',
                                product: 'Classic Leather Bag',
                                serial: 'SN-BAG-992X',
                                status: '고객 수락 대기',
                                statusClass: 'bg-yellow-50 text-yellow-700',
                                action: '재알림 발송',
                                actionStyle: { color: theme.primary },
                            },
                            {
                                soldAt: '2026.03.04 18:45',
                                product: 'Wool Blend Coat',
                                serial: 'SN-COT-881Y',
                                status: '등록 전',
                                statusClass: 'bg-gray-100 text-gray-600',
                                action: '이전 시작',
                                actionStyle: { backgroundColor: theme.primary },
                                primaryAction: true,
                            },
                        ].map((row) => (
                            <div key={`${row.serial}-${row.soldAt}`} className="space-y-3 px-5 py-4">
                                <div className="text-xs text-gray-500">{row.soldAt}</div>
                                <div className="font-semibold text-gray-900 break-words">{row.product}</div>
                                <div className="break-all text-sm text-gray-500">{row.serial}</div>
                                <span className={`inline-flex w-fit px-2 py-1 text-xs rounded-full font-medium ${row.statusClass}`}>
                                    {row.status}
                                </span>
                                {row.primaryAction ? (
                                    <button className="w-full rounded-lg px-3 py-2 text-xs font-medium text-white transition-colors" style={row.actionStyle}>
                                        {row.action}
                                    </button>
                                ) : (
                                    <button className="text-sm font-medium hover:underline" style={row.actionStyle}>
                                        {row.action}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="hidden overflow-x-auto md:block">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 text-gray-500 text-sm">
                                    <th className="px-6 py-3 font-medium">판매 일자</th>
                                    <th className="px-6 py-3 font-medium">상품 정보</th>
                                    <th className="px-6 py-3 font-medium">시리얼 번호</th>
                                    <th className="px-6 py-3 font-medium">소유권 상태</th>
                                    <th className="px-6 py-3 font-medium">액션</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm divide-y divide-gray-200">
                                <tr className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-gray-500">2026.03.05 14:30</td>
                                    <td className="px-6 py-4 font-medium text-gray-900">Limited Edition Sneakers</td>
                                    <td className="px-6 py-4 text-gray-500">SN-2023-003Z</td>
                                    <td className="px-6 py-4"><span className="px-2 py-1 text-xs rounded-full bg-green-50 text-green-600 font-medium">이전 완료</span></td>
                                    <td className="px-6 py-4"><button className="hover:underline font-medium" style={{ color: theme.primary }}>증명서 보기</button></td>
                                </tr>
                                <tr className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-gray-500">2026.03.05 11:15</td>
                                    <td className="px-6 py-4 font-medium text-gray-900">Classic Leather Bag</td>
                                    <td className="px-6 py-4 text-gray-500">SN-BAG-992X</td>
                                    <td className="px-6 py-4"><span className="px-2 py-1 text-xs rounded-full bg-yellow-50 text-yellow-700 font-medium">고객 수락 대기</span></td>
                                    <td className="px-6 py-4"><button className="hover:underline font-medium" style={{ color: theme.primary }}>재알림 발송</button></td>
                                </tr>
                                <tr className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-gray-500">2026.03.04 18:45</td>
                                    <td className="px-6 py-4 font-medium text-gray-900">Wool Blend Coat</td>
                                    <td className="px-6 py-4 text-gray-500">SN-COT-881Y</td>
                                    <td className="px-6 py-4"><span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600 font-medium">등록 전</span></td>
                                    <td className="px-6 py-4"><button className="px-3 py-1.5 rounded text-xs font-medium text-white transition-colors" style={{ backgroundColor: theme.primary }}>이전 시작</button></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <aside className="rounded-[1.5rem] border border-gray-200 bg-white p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-900">운영 포인트</h3>
                    <div className="mt-5 space-y-4">
                        <div className="rounded-xl p-4" style={{ backgroundColor: theme.bg }}>
                            <div className="text-sm font-semibold" style={{ color: theme.primary }}>입고 확인</div>
                            <p className="mt-2 text-sm leading-6 text-gray-600">QR 또는 바코드 스캔으로 실물과 디지털 자산을 빠르게 일치시킵니다.</p>
                        </div>
                        <div className="rounded-xl bg-gray-50 p-4">
                            <div className="text-sm font-semibold text-gray-900">이전 완료율 관리</div>
                            <p className="mt-2 text-sm leading-6 text-gray-600">고객 수락 대기 건을 줄이면 등록 경험과 브랜드 신뢰가 함께 좋아집니다.</p>
                        </div>
                        <div className="rounded-xl bg-gray-50 p-4">
                            <div className="text-sm font-semibold text-gray-900">매장 운영 일관성</div>
                            <p className="mt-2 text-sm leading-6 text-gray-600">매장별 재고와 이전 이력을 같은 화면 문법으로 관리할 수 있습니다.</p>
                        </div>
                    </div>
                </aside>
            </section>
        </div>
    );
};

export default RetailView;
