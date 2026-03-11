import React, { useEffect, useMemo, useState } from 'react';
import { Building2, ChevronRight, RefreshCw, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/useAuthStore';
import { getCurrentMembership, hasEffectiveScope, toPermissionMessage } from '../../utils/permissionUi';

const BRANDS_PAGE_SIZE = 10;

const RetailInventoryView = () => {
  const navigate = useNavigate();
  const { user, myMemberships, partnerLinks, fetchPartnerLinks } = useAuthStore();
  const currentMembership = getCurrentMembership(myMemberships, user?.tenantId, 'RETAIL');
  const canReadRetailInventory = hasEffectiveScope(currentMembership, 'TENANT_READ_ONLY');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [brandPage, setBrandPage] = useState(0);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError('');
      if (!canReadRetailInventory) {
        setError(toPermissionMessage({ status: 403, message: 'Access denied' }, 'DEFAULT'));
        setLoading(false);
        return;
      }
      const partnerRes = await fetchPartnerLinks('ACTIVE');
      if (!mounted) return;
      if (!partnerRes?.success) {
        setError(partnerRes?.message || '브랜드 목록을 불러오지 못했습니다.');
      }
      setLoading(false);
    };
    load().catch((e) => {
      if (!mounted) return;
      setError(e?.message || '데이터를 불러오지 못했습니다.');
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [canReadRetailInventory, fetchPartnerLinks]);

  const groupedBrands = useMemo(() => {
    const myTenantId = user?.tenantId;
    if (!myTenantId) return [];

    const keyword = searchTerm.trim().toLowerCase();
    return (partnerLinks || [])
      .filter((link) =>
        link?.status === 'ACTIVE' &&
        link?.targetTenantId === myTenantId &&
        String(link?.sourceType || '').toUpperCase() === 'BRAND'
      )
      .filter((link) => {
        if (!keyword) return true;
        return (
          String(link?.sourceTenantName || '').toLowerCase().includes(keyword) ||
          String(link?.sourceTenantId || '').toLowerCase().includes(keyword)
        );
      })
      .map((link) => ({
        brandTenantId: link.sourceTenantId,
        brandName: link.sourceTenantName || '이름 없는 브랜드',
        partnerLinkId: link.partnerLinkId,
      }));
  }, [partnerLinks, searchTerm, user?.tenantId]);

  useEffect(() => {
    setBrandPage(0);
  }, [searchTerm]);

  const totalBrandPages = Math.max(1, Math.ceil(groupedBrands.length / BRANDS_PAGE_SIZE));
  const currentBrandPage = Math.min(brandPage, totalBrandPages - 1);
  const pagedBrands = groupedBrands.slice(
    currentBrandPage * BRANDS_PAGE_SIZE,
    currentBrandPage * BRANDS_PAGE_SIZE + BRANDS_PAGE_SIZE
  );

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">보유 제품 관리</h1>
          <p className="text-gray-500 mt-1">브랜드를 선택하면 해당 브랜드의 보유 제품 목록으로 이동합니다.</p>
        </div>

        <button
          type="button"
          onClick={async () => {
            setLoading(true);
            setError('');
            if (!canReadRetailInventory) {
              setError(toPermissionMessage({ status: 403, message: 'Access denied' }, 'DEFAULT'));
              setLoading(false);
              return;
            }
            try {
              const partnerRes = await fetchPartnerLinks('ACTIVE');
              if (!partnerRes?.success) setError(partnerRes?.message || '새로고침에 실패했습니다.');
            } catch (e) {
              setError(e?.message || '새로고침에 실패했습니다.');
            }
            setLoading(false);
          }}
          className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 bg-white rounded-lg text-sm font-medium hover:bg-gray-50"
        >
          <RefreshCw size={16} />
          새로고침
        </button>
      </header>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="브랜드명 또는 Tenant ID 검색"
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
          />
        </div>
      </div>

      <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">파트너 브랜드 목록</h2>
          <span className="text-xs font-semibold text-gray-500">총 {groupedBrands.length}개</span>
        </div>

        {loading ? (
          <div className="px-5 py-10 text-sm text-gray-500">불러오는 중...</div>
        ) : error ? (
          <div className="px-5 py-10 text-sm text-amber-800">{error}</div>
        ) : groupedBrands.length === 0 ? (
          <div className="px-5 py-10 text-sm text-gray-500">현재 연결된 ACTIVE 브랜드가 없습니다.</div>
        ) : (
          <>
            <div className="divide-y divide-gray-100">
              {pagedBrands.map((brand) => (
                <button
                  key={brand.brandTenantId}
                  type="button"
                  onClick={() => navigate(`/retail/inventory/${brand.brandTenantId}`, {
                    state: {
                      brandName: brand.brandName,
                      partnerLinkId: brand.partnerLinkId,
                    },
                  })}
                  className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-3 text-left">
                    <div className="p-2 rounded-lg bg-green-50 text-green-700">
                      <Building2 size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900">{brand.brandName}</div>
                      <div className="text-xs text-gray-500 mt-1">Tenant ID: {brand.brandTenantId}</div>
                      <div className="text-xs text-gray-400 mt-1">PartnerLink: {brand.partnerLinkId}</div>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-gray-500 shrink-0" />
                </button>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/60">
              <span className="text-xs text-gray-500">
                페이지 {currentBrandPage + 1} / {totalBrandPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBrandPage((prev) => Math.max(0, prev - 1))}
                  disabled={currentBrandPage === 0}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  이전
                </button>
                <button
                  type="button"
                  onClick={() => setBrandPage((prev) => Math.min(totalBrandPages - 1, prev + 1))}
                  disabled={currentBrandPage >= totalBrandPages - 1}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  다음
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default RetailInventoryView;
