import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, RefreshCw, QrCode, Building2 } from 'lucide-react';

const MainPage = () => {
    return (
        <div className="animate-in fade-in duration-500">
            {/* Hero Section */}
            <section className="bg-gray-900 text-white py-20 px-6">
                <div className="max-w-6xl mx-auto text-center">
                    <h1 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">
                        투명하고 신뢰할 수 있는<br />
                        <span className="text-blue-400">디지털 제품 여권 시스템</span>
                    </h1>
                    <p className="text-lg text-gray-300 mb-10 max-w-2xl mx-auto">
                        DPP Ledger는 제조사부터 소비자까지 모든 상품의 라이프사이클을 추적하고 소유권을 증명합니다.
                        위변조 없는 확실한 디지털 여권, 지금 시작해보세요.
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <Link to="/onboarding" className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-8 rounded-lg transition-colors">
                            업체로 참여하기 (Onboarding)
                        </Link>
                        <button className="bg-white hover:bg-gray-100 text-gray-900 font-medium py-3 px-8 rounded-lg transition-colors">
                            앱 다운로드
                        </button>
                    </div>
                </div>
            </section>

            {/* User Features Grid */}
            <section className="py-20 px-6 max-w-6xl mx-auto">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold text-gray-900 mb-4">일반 사용자 주요 기능</h2>
                    <p className="text-gray-500">소비자로서 제공받는 안전한 소유권 증명 액션입니다.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                        <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-6">
                            <RefreshCw size={28} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">소유권 이전 받기</h3>
                        <p className="text-gray-500 mb-6 line-clamp-2">리테일러나 이전 소유자로부터 제품의 디지털 소유권을 안전하게 양도받습니다.</p>
                        <button className="text-indigo-600 font-semibold group-hover:underline">이전 요청 수락하기 →</button>
                        <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-4 -translate-y-4">
                            <RefreshCw size={100} />
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                        <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-6">
                            <ShieldCheck size={28} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">소유권 양도하기</h3>
                        <p className="text-gray-500 mb-6 line-clamp-2">중고 거래 또는 양도 시 내가 보유한 자산에 대한 권리를 새로운 소유자에게 넘깁니다.</p>
                        <button className="text-emerald-600 font-semibold group-hover:underline">양도 절차 시작 →</button>
                        <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-4 -translate-y-4">
                            <ShieldCheck size={100} />
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                        <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-6">
                            <QrCode size={28} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">내 디지털 자산 보기</h3>
                        <p className="text-gray-500 mb-6 line-clamp-2">내가 보유한 제품들의 디지털 여권(Passport) 목록과 상세 이력을 블록체인 기반으로 조회합니다.</p>
                        <button className="text-blue-600 font-semibold group-hover:underline">자산 목록 보기 →</button>
                        <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-4 -translate-y-4">
                            <QrCode size={100} />
                        </div>
                    </div>
                </div>
            </section>

            {/* Tenant Teaser */}
            <section className="bg-blue-50 py-16 px-6">
                <div className="max-w-4xl mx-auto text-center">
                    <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Building2 size={32} />
                    </div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-4">비즈니스를 위한 파트너가 되어주세요.</h2>
                    <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
                        제조(Brand), 유통(Retail), 고객지원(Service) 기업을 위한 맞춤형 대시보드가 준비되어 있습니다.
                        간단한 승인 과정을 거쳐 투명한 시장 생태계에 합류할 수 있습니다.
                    </p>
                    <Link to="/onboarding" className="inline-block bg-gray-900 text-white font-medium py-3 px-8 rounded-lg hover:bg-gray-800 transition-colors shadow-md">
                        업체 신청 페이지 바로가기
                    </Link>
                </div>
            </section>
        </div>
    );
};

export default MainPage;
