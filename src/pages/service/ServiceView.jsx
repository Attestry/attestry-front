import React, { useEffect, useState } from 'react';
import { CheckCircle2, ClipboardList, FileCheck, RefreshCw, Wrench } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useAuthStore, { ROLE_THEMES } from '../../store/useAuthStore';
import {
  fetchProviderRequests,
  hasServiceManagePermission,
  hasServiceViewPermission,
  SERVICE_PERMISSION_GUIDE,
  SERVICE_VIEW_PERMISSION_GUIDE,
  toServiceErrorMessage,
} from './serviceApi';

const ServiceView = () => {
  const navigate = useNavigate();
  const { user, myMemberships } = useAuthStore();
  const theme = ROLE_THEMES[user.role];
  const canViewService = hasServiceViewPermission(myMemberships, user?.tenantId);
  const canManageService = hasServiceManagePermission(myMemberships, user?.tenantId);
  const [summary, setSummary] = useState({ pending: 0, accepted: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    if (!user?.tenantId) {
      setLoading(false);
      return;
    }
    if (!canViewService) {
      setSummary({ pending: 0, accepted: 0, completed: 0 });
      setError(SERVICE_VIEW_PERMISSION_GUIDE);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [pending, accepted, completed] = await Promise.all([
        fetchProviderRequests(user.tenantId, 'PENDING', 0, 1),
        fetchProviderRequests(user.tenantId, 'ACCEPTED', 0, 1),
        fetchProviderRequests(user.tenantId, 'COMPLETED', 0, 1),
      ]);
      setSummary({
        pending: pending?.totalElements || 0,
        accepted: accepted?.totalElements || 0,
        completed: completed?.totalElements || 0,
      });
    } catch (e) {
      setError(toServiceErrorMessage(e, '서비스 대시보드를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => {});
  }, [canManageService, canViewService, user?.tenantId]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col gap-4 rounded-[1.75rem] border border-gray-200 bg-white px-6 py-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: theme.primary }}>Service profile</div>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">서비스 대시보드</h1>
          <p className="mt-1 text-gray-500">서비스 요청 접수, 처리, 완료 이력을 한 흐름으로 관리합니다.</p>
        </div>
        <button
          type="button"
          onClick={() => canViewService && load()}
          disabled={!canViewService}
          title={!canViewService ? SERVICE_VIEW_PERMISSION_GUIDE : undefined}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-medium text-white shadow-sm transition-all hover:-translate-y-0.5"
          style={{ backgroundColor: canViewService ? theme.primary : '#9ca3af' }}
        >
          <RefreshCw size={18} />
          새로고침
        </button>
      </header>

      {error && <div className="rounded-[1.25rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <button
          type="button"
          onClick={() => canViewService && navigate('/service/requests')}
          disabled={!canViewService}
          title={!canViewService ? SERVICE_VIEW_PERMISSION_GUIDE : undefined}
          className={`rounded-[1.5rem] border p-6 text-left shadow-sm transition ${canViewService
            ? 'border-gray-200 bg-white hover:-translate-y-0.5 hover:shadow-md'
            : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
            }`}
        >
          <div className="flex items-start gap-4">
            <div className="rounded-xl p-3" style={{ backgroundColor: theme.bg, color: theme.primary }}><ClipboardList size={24} /></div>
            <div>
              <div className="text-sm font-medium text-gray-500">대기 중인 요청</div>
              <div className="mt-1 text-2xl font-bold text-gray-900">{loading ? '-' : summary.pending}</div>
              <div className="mt-1 text-xs font-medium text-amber-600">수락/반려 대기</div>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => canViewService && navigate('/service/processing')}
          disabled={!canViewService}
          title={!canViewService ? SERVICE_VIEW_PERMISSION_GUIDE : undefined}
          className={`rounded-[1.5rem] border p-6 text-left shadow-sm transition ${canViewService
            ? 'border-gray-200 bg-white hover:-translate-y-0.5 hover:shadow-md'
            : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
            }`}
        >
          <div className="flex items-start gap-4">
            <div className="rounded-xl p-3" style={{ backgroundColor: theme.bg, color: theme.primary }}><Wrench size={24} /></div>
            <div>
              <div className="text-sm font-medium text-gray-500">진행 중 상태</div>
              <div className="mt-1 text-2xl font-bold text-gray-900">{loading ? '-' : summary.accepted}</div>
              <div className="mt-1 text-xs font-medium text-blue-600">완료 처리 가능</div>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => canViewService && navigate('/service/history')}
          disabled={!canViewService}
          title={!canViewService ? SERVICE_VIEW_PERMISSION_GUIDE : undefined}
          className={`rounded-[1.5rem] border p-6 text-left shadow-sm transition ${canViewService
            ? 'border-gray-200 bg-white hover:-translate-y-0.5 hover:shadow-md'
            : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
            }`}
        >
          <div className="flex items-start gap-4">
            <div className="rounded-xl p-3" style={{ backgroundColor: theme.bg, color: theme.primary }}><FileCheck size={24} /></div>
            <div>
              <div className="text-sm font-medium text-gray-500">완료 이력</div>
              <div className="mt-1 text-2xl font-bold text-gray-900">{loading ? '-' : summary.completed}</div>
              <div className="mt-1 text-xs font-medium text-green-600">완료/반려/취소 이력 확인</div>
            </div>
          </div>
        </button>
      </div>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="rounded-[1.5rem] border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-gray-100 px-6 py-4">
          <CheckCircle2 size={18} style={{ color: theme.primary }} />
          <h2 className="text-lg font-bold text-gray-800">현재 처리 가이드</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 px-6 py-5 md:grid-cols-3">
          <div className="rounded-[1.25rem] bg-amber-50 p-4">
            <div className="text-sm font-bold text-amber-800">1. 요청 관리</div>
            <p className="mt-2 text-sm text-amber-700">새로 들어온 `PENDING` 요청을 확인하고 수락 또는 반려합니다.</p>
          </div>
          <div className="rounded-[1.25rem] p-4" style={{ backgroundColor: theme.bg }}>
            <div className="text-sm font-bold" style={{ color: theme.primary }}>2. 수신 요청 처리</div>
            <p className="mt-2 text-sm" style={{ color: '#92400e' }}>수락된 `ACCEPTED` 요청을 실제 서비스 완료 상태로 전환합니다.</p>
          </div>
          <div className="rounded-[1.25rem] bg-green-50 p-4">
            <div className="text-sm font-bold text-green-800">3. 완료 이력 관리</div>
            <p className="mt-2 text-sm text-green-700">완료, 반려, 취소된 요청 이력을 상태별로 조회합니다.</p>
          </div>
        </div>
        </div>

        <aside className="rounded-[1.5rem] border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900">서비스 운영 메모</h3>
          <div className="mt-5 space-y-4">
            <div className="rounded-xl p-4" style={{ backgroundColor: theme.bg }}>
              <div className="text-sm font-semibold" style={{ color: theme.primary }}>처리 우선순위</div>
              <p className="mt-2 text-sm leading-6 text-gray-600">대기 요청과 진행 요청을 분리해 보면 처리 병목을 빠르게 찾을 수 있습니다.</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <div className="text-sm font-semibold text-gray-900">권한 분리</div>
              <p className="mt-2 text-sm leading-6 text-gray-600">조회 권한과 처리 권한을 나눠 운영해도 화면 구조는 그대로 유지됩니다.</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <div className="text-sm font-semibold text-gray-900">완료 이력 신뢰성</div>
              <p className="mt-2 text-sm leading-6 text-gray-600">서비스 완료 이력은 제품 신뢰와 재판매 가치에 직접 연결됩니다.</p>
            </div>
          </div>
        </aside>
      </section>
      {!canManageService && canViewService && (
        <div className="rounded-[1.25rem] border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          목록 조회는 가능하지만 수락, 반려, 완료 처리는 서비스 처리 권한이 있는 멤버만 수행할 수 있습니다.
        </div>
      )}
    </div>
  );
};

export default ServiceView;
