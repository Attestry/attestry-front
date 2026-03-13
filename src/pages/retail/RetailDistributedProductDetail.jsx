import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Calendar, Database, Factory, Hash, Loader2, Package, QrCode, ShieldCheck, AlertTriangle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import useAuthStore from '../../store/useAuthStore';
import { apiFetchJson } from '../../utils/api';
import { normalizeApiErrorMessage } from '../../utils/permissionUi';

const fetchWithAuth = async (url, options = {}) => {
  const token = useAuthStore.getState().accessToken;
  return apiFetchJson(url, options, {
    token,
    fallbackMessage: normalizeApiErrorMessage('', undefined, '제품 상세 정보를 불러오지 못했습니다.')
  });
};

const InfoItem = ({ icon, label, value, mono = false }) => (
  <div>
    <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">{icon}<span>{label}</span></div>
    <div className={`mt-2 text-sm font-medium text-gray-900 break-all ${mono ? 'font-mono text-xs' : ''}`}>{value || '-'}</div>
  </div>
);

const RetailDistributedProductDetail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { passportId } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const brandName = location.state?.brandName || '브랜드';
  const backTo = location.state?.from || '/retail/inventory';
  const detailMode = location.state?.detailMode || 'active-distributed';
  const publicUrl = useMemo(() => (
    passportId ? `${window.location.origin}/products/passports/${encodeURIComponent(passportId)}` : ''
  ), [passportId]);

  useEffect(() => {
    if (!passportId) {
      setError('제품 정보가 올바르지 않습니다.');
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);
    setError('');
    const detailUrl = detailMode === 'completed-transfer'
      ? `/products/tenant/completed-transfers/${encodeURIComponent(passportId)}`
      : `/products/tenant/distributed-passports/${encodeURIComponent(passportId)}`;
    fetchWithAuth(detailUrl)
      .then((data) => {
        if (!mounted) return;
        setProduct(data);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.message || '제품 상세 정보를 불러오지 못했습니다.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [detailMode, passportId]);

  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center text-gray-500">
        <div className="flex items-center gap-3">
          <Loader2 size={22} className="animate-spin" />
          <span className="text-sm font-medium">제품 상세 정보를 불러오는 중...</span>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-6">
        <button
          type="button"
          onClick={() => navigate(backTo)}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft size={16} />
          목록으로 돌아가기
        </button>
        <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
          <AlertTriangle size={40} className="mx-auto mb-4 text-red-400" />
          <h2 className="text-lg font-bold text-red-900">상세 정보를 불러오지 못했습니다</h2>
          <p className="mt-2 text-sm text-red-600">{error || '해당 제품을 찾을 수 없습니다.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate(backTo)}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800"
          >
            <ArrowLeft size={16} />
            목록으로 돌아가기
          </button>
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-600">Retail Product Detail</p>
            <h1 className="mt-2 text-3xl font-bold text-gray-900">{product.modelName || '-'}</h1>
            <p className="mt-2 text-sm text-gray-500">{brandName}</p>
          </div>
        </div>
        <div className={`inline-flex items-center gap-2 self-start rounded-full px-3 py-1 text-xs font-semibold ${product.assetState === 'ACTIVE' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
          <Package size={14} />
          {product.assetState || '-'}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 lg:col-span-2">
          <div className="mb-6 flex items-center gap-2 text-sm font-bold text-gray-900">
            <Database size={18} className="text-green-600" />
            제품 정보
          </div>
          <div className="grid grid-cols-1 gap-x-12 gap-y-6 md:grid-cols-2">
            <InfoItem icon={<Hash size={16} />} label="Model Name" value={product.modelName} />
            <InfoItem icon={<Hash size={16} />} label="Model ID" value={product.modelId} mono />
            <InfoItem icon={<Package size={16} />} label="Serial Number" value={product.serialNumber} mono />
            <InfoItem icon={<ShieldCheck size={16} />} label="Risk Flag" value={product.riskFlag} />
            <InfoItem icon={<Calendar size={16} />} label="Manufactured At" value={product.manufacturedAt ? new Date(product.manufacturedAt).toLocaleString() : '-'} />
            <InfoItem icon={<Package size={16} />} label="Production Batch" value={product.productionBatch} />
            <InfoItem icon={<Factory size={16} />} label="Factory Code" value={product.factoryCode} />
            <InfoItem icon={<QrCode size={16} />} label="QR Public Code" value={product.qrPublicCode} mono />
          </div>
        </section>

        <aside className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-900">
            <QrCode size={18} className="text-green-600" />
            QR 확인
          </div>
          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-6 text-center">
            <QRCodeSVG value={publicUrl || product.passportId || '-'} size={176} level="M" includeMargin />
          </div>
          <div className="mt-4 space-y-3">
            <div className="text-xs text-gray-500">
              브랜드 발행 시점에 고정된 공개 검증 경로를 QR로 표현한 것입니다. 공개 코드는 변경되지 않습니다.
            </div>
            <button
              type="button"
              onClick={() => window.open(publicUrl, '_blank', 'noopener,noreferrer')}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <ShieldCheck size={16} className="text-green-600" />
              공개 원장 확인
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default RetailDistributedProductDetail;
