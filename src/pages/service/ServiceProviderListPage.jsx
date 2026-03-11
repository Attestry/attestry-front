import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, MapPin, RefreshCw, Search, Wrench } from 'lucide-react';
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
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <header className="flex flex-col gap-4 border-b border-gray-200 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
            <Wrench size={14} />
            1단계 MVP
          </div>
          <h1 className="mt-3 text-3xl font-bold text-gray-900">서비스 업체 찾기</h1>
          <p className="mt-2 text-sm text-gray-500">
            현재 등록된 서비스 업체를 조회하고 원하는 업체를 선택해 서비스 신청을 시작합니다.
          </p>
          <p className="mt-1 text-xs text-gray-400">
            현재는 업체명, 지역, 주소 기준으로 탐색합니다. 상세 신청서 확장은 2단계에서 진행합니다.
          </p>
          {selectedPassport && (
            <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              선택 자산: {selectedPassport.modelName || '-'} / {selectedPassport.serialNumber || selectedPassport.passportId}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
          >
            QR로 자산 선택
          </button>
          <button
            type="button"
            onClick={() => load()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            <RefreshCw size={16} />
            새로고침
          </button>
        </div>
      </header>

      <section className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-3 text-gray-400" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="업체명, 지역 또는 주소로 검색"
            className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
          />
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-10 text-sm text-gray-500">
            서비스 업체 목록을 불러오는 중입니다...
          </div>
        ) : filteredProviders.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-10 text-sm text-gray-500">
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
              className="rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold text-gray-900">{provider.name || '이름 없는 서비스 업체'}</div>
                  <div className="mt-2 inline-flex items-center gap-1 text-sm text-gray-500">
                    <MapPin size={14} />
                    {provider.region || '지역 정보 없음'}
                  </div>
                  {provider.address && (
                    <div className="mt-2 text-xs text-gray-500">{provider.address}</div>
                  )}
                  <div className="mt-3 text-xs text-gray-400">Tenant ID: {provider.tenantId}</div>
                </div>
                <ArrowRight size={18} className="shrink-0 text-amber-600" />
              </div>
            </button>
          ))
        )}
      </section>
      <QRScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={handleQrScanSuccess}
      />
    </div>
  );
};

export default ServiceProviderListPage;
