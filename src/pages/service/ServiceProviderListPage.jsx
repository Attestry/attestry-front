import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, MapPin, RefreshCw, Search, ShieldCheck, Wrench } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import QRScannerModal from '../../components/shipment/QRScannerModal';
import { listMyPassports, listServiceProviders } from './consumerServiceApi';
import { extractPassportIdFromQr } from './serviceQr';

const ServiceProviderListPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const selectedPassport = location.state?.selectedPassport || null;
  const [providers, setProviders] = useState([]);
  const [passports, setPassports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [providerData, passportData] = await Promise.all([
        listServiceProviders(),
        listMyPassports(),
      ]);
      setProviders(Array.isArray(providerData?.content) ? providerData.content : []);
      setPassports(Array.isArray(passportData) ? passportData : []);
    } catch (e) {
      setError(e?.message || '서비스 업체 목록을 불러오지 못했습니다.');
      setProviders([]);
      setPassports([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const filteredProviders = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return providers;
    return providers.filter((provider) =>
      String(provider?.name || '').toLowerCase().includes(keyword) ||
      String(provider?.region || '').toLowerCase().includes(keyword) ||
      String(provider?.address || '').toLowerCase().includes(keyword)
    );
  }, [providers, searchTerm]);

  const handleQrScanSuccess = (decodedText) => {
    const passportId = extractPassportIdFromQr(decodedText);
    const matchedPassport = passports.find((passport) => passport.passportId === passportId);

    setScannerOpen(false);
    if (!matchedPassport) {
      setError('스캔한 QR이 현재 내 자산 목록과 일치하지 않습니다. 내 디지털 자산의 공개 QR을 다시 확인해주세요.');
      return;
    }

    navigate('/service-request/providers', {
      replace: true,
      state: { selectedPassport: matchedPassport },
    });
  };

  return (
    <div className="tracera-workflow-page mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-6 md:py-10">
      <header className="tracera-workflow-hero">
        <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <div className="tracera-workflow-tag">
              <Wrench size={14} />
              SERVICE REQUEST
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-white md:text-[2.6rem]">
              믿고 맡길 수 있는 서비스 파트너를
              <br className="hidden md:block" />
              빠르게 선택하세요
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-200 md:text-base">
              Proveny에 연결된 서비스 업체를 비교하고, 내 제품에 맞는 접수 흐름으로 바로 이어집니다.
            </p>
            {selectedPassport && (
              <div className="mt-4 inline-flex max-w-full items-center gap-2 rounded-2xl border border-white/20 bg-white/12 px-4 py-3 text-sm font-medium text-white shadow-sm backdrop-blur-sm">
                <ShieldCheck size={16} className="shrink-0" />
                <span className="truncate">
                  선택 자산: {selectedPassport.modelName || '-'} / {selectedPassport.serialNumber || selectedPassport.passportId}
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button type="button" onClick={() => setScannerOpen(true)} className="tracera-workflow-button-secondary w-full justify-center sm:w-auto">
              QR로 자산 선택
            </button>
            <button type="button" onClick={() => load()} className="tracera-workflow-button w-full justify-center sm:w-auto">
              <RefreshCw size={16} />
              새로고침
            </button>
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
        <div className="tracera-workflow-section p-4 md:p-5">
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="업체명, 지역 또는 주소로 검색"
              className="tracera-workflow-field pl-11"
            />
          </div>
        </div>
        <div className="tracera-workflow-section bg-[linear-gradient(145deg,#fffdf8,#ffffff)] p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">선택 기준</div>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            지역, 주소, 업체명을 기준으로 비교하고 상세 화면에서 접수 정보를 바로 확인합니다.
          </p>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <div className="tracera-workflow-section px-5 py-12 text-sm text-slate-500">
            서비스 업체 목록을 불러오는 중입니다...
          </div>
        ) : filteredProviders.length === 0 ? (
          <div className="tracera-workflow-section px-5 py-12 text-sm text-slate-500">
            검색 조건에 맞는 서비스 업체가 없습니다.
          </div>
        ) : (
          filteredProviders.map((provider) => (
            <button
              key={provider.tenantId}
              type="button"
              onClick={() => navigate(`/service-request/providers/${provider.tenantId}`, {
                state: { provider, selectedPassport },
              })}
              className="group tracera-workflow-section p-5 text-left transition hover:-translate-y-1 hover:border-amber-200 hover:shadow-[0_28px_70px_-42px_rgba(180,83,9,.18)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="inline-flex items-center rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                    서비스 파트너
                  </div>
                  <div className="mt-4 text-xl font-semibold tracking-tight text-slate-950">
                    {provider.name || '이름 없는 서비스 업체'}
                  </div>
                  <div className="mt-3 inline-flex items-center gap-1.5 text-sm text-slate-500">
                    <MapPin size={14} />
                    {provider.region || '지역 정보 없음'}
                  </div>
                  {provider.address && (
                    <div className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{provider.address}</div>
                  )}
                  <div className="mt-4 text-xs text-slate-400">Tenant ID: {provider.tenantId}</div>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white transition group-hover:bg-[#6f5748]">
                  <ArrowRight size={18} />
                </div>
              </div>
            </button>
          ))
        )}
      </section>
      <QRScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={handleQrScanSuccess}
        title="내 자산 QR 스캔"
        description="서비스 신청할 제품의 QR을 스캔하면 자동으로 자산이 선택됩니다."
        tip="내 디지털 자산의 공개 QR을 스캔하면 현재 선택 화면으로 바로 돌아옵니다."
        uploadLabel="QR 이미지로 선택하기"
      />
    </div>
  );
};

export default ServiceProviderListPage;
