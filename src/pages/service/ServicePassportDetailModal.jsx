import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Loader2, ShieldCheck, X } from 'lucide-react';
import QRCode from 'qrcode';
import { resolveApiUrl, unwrapApiResponse } from '../../utils/api';
import useAuthStore from '../../store/useAuthStore';

const EVENT_LABELS = {
  'GENESIS:MINTED': '제품 제조 및 검수 완료',
  'OWNERSHIP:CLAIMED': '소유권 최초 등록',
  'OWNERSHIP:TRANSFER_COMPLETED': '소유권 이전 완료',
  'OWNERSHIP:PURCHASE_CLAIM_APPROVED': '디지털 자산 등록 승인',
  'SHIPMENT:RELEASED': '제품 출고 처리 완료',
  'SHIPMENT:RETURNED': '제품 반품 처리 완료',
  'SERVICE:SERVICE_CONFIRMED': '서비스 처리 완료',
  'LIFECYCLE:VOIDED': '제품 사용 중지 처리',
  'RISK:STOLEN_FLAGGED': '도난 신고 등록',
  'RISK:LOST_FLAGGED': '분실 신고 등록',
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

const maskId = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '-';
  if (raw.length <= 2) return `${raw[0]}*`;
  return `${raw[0]}${'*'.repeat(Math.min(6, Math.max(3, raw.length - 2)))}${raw[raw.length - 1]}`;
};

const resolveRiskClearedLabel = (entry, entries) => {
  const clearedRiskFlag = String(entry?.payload?.clearedRiskFlag || '').toUpperCase();
  if (clearedRiskFlag === 'STOLEN') return '도난 신고 취소';
  if (clearedRiskFlag === 'LOST') return '분실 신고 취소';

  const clearedAt = new Date(entry?.occurredAt || 0).getTime();
  const latestFlaggedEntry = (Array.isArray(entries) ? entries : [])
    .filter((candidate) => {
      const category = String(candidate?.event?.category || '').toUpperCase();
      const action = String(candidate?.event?.action || '').toUpperCase();
      if (category !== 'RISK') return false;
      if (action !== 'STOLEN_FLAGGED' && action !== 'LOST_FLAGGED') return false;
      const occurredAt = new Date(candidate?.occurredAt || 0).getTime();
      return Number.isFinite(occurredAt) && occurredAt <= clearedAt;
    })
    .sort((a, b) => new Date(b?.occurredAt || 0).getTime() - new Date(a?.occurredAt || 0).getTime())[0];

  const latestAction = String(latestFlaggedEntry?.event?.action || '').toUpperCase();
  if (latestAction === 'STOLEN_FLAGGED') return '도난 신고 취소';
  if (latestAction === 'LOST_FLAGGED') return '분실 신고 취소';
  return '분실/도난 신고 취소';
};

const eventTitle = (entry, entries) => {
  const category = String(entry?.event?.category || '').toUpperCase();
  const action = String(entry?.event?.action || '').toUpperCase();
  if (category === 'RISK' && action === 'RISK_CLEARED') {
    return resolveRiskClearedLabel(entry, entries);
  }
  return EVENT_LABELS[`${category}:${action}`] || `${category || 'EVENT'} · ${action || 'UNKNOWN'}`;
};

const findPayloadValue = (entries, keys) => {
  if (!Array.isArray(entries) || !entries.length) return null;
  const normalizedKeys = keys.map((key) => String(key).toLowerCase());
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const payload = entries[i]?.payload;
    if (!payload || typeof payload !== 'object') continue;
    for (const [key, value] of Object.entries(payload)) {
      if (!normalizedKeys.includes(String(key).toLowerCase())) continue;
      const normalizedValue = String(value ?? '').trim();
      if (normalizedValue) return normalizedValue;
    }
  }
  return null;
};

const readJsonSafe = async (response, fallbackMessage) => {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    const text = await response.text();
    const preview = String(text || '').trim().slice(0, 120);
    throw new Error(`${fallbackMessage} (JSON 아님: ${preview || 'empty response'})`);
  }
  const payload = await response.json();
  return unwrapApiResponse(payload);
};

const buildLedgerBackedDetail = (passportId, stateData, ownerData, entries) => {
  const safeEntries = Array.isArray(entries) ? entries : [];
  return {
    passportId: stateData?.passportId || passportId,
    assetId: stateData?.assetId || null,
    assetState: stateData?.assetState || null,
    riskFlag: stateData?.riskFlag || null,
    ownerId: ownerData?.ownerId || null,
    modelName: findPayloadValue(safeEntries, ['modelName', 'model_name', 'model']) || null,
    serialNumber: findPayloadValue(safeEntries, ['serialNumber', 'serial_number', 'serialNo', 'serial_no']) || null,
  };
};

const ProductPassportDetailModal = ({ passportId, isOpen, onClose }) => {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ledgerError, setLedgerError] = useState('');
  const [detail, setDetail] = useState(null);
  const [entries, setEntries] = useState([]);
  const [verification, setVerification] = useState(null);
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [publicQrImage, setPublicQrImage] = useState('');
  const [publicQrLoading, setPublicQrLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !passportId) return;

    let active = true;
    const fetchWithAuth = (url) => (
      accessToken
        ? fetch(resolveApiUrl(url), { headers: { Authorization: `Bearer ${accessToken}` } })
        : fetch(resolveApiUrl(url))
    );
    const load = async () => {
      setLoading(true);
      setError('');
      setLedgerError('');
      setExpandedIds(new Set());

      try {
        const [stateRes, ownerRes, entriesRes, verifyRes] = await Promise.allSettled([
          fetchWithAuth(`/products/passports/${encodeURIComponent(passportId)}/state`),
          fetchWithAuth(`/products/passports/${encodeURIComponent(passportId)}/owner`),
          fetchWithAuth(`/ledgers/passports/${encodeURIComponent(passportId)}/entries`),
          fetchWithAuth(`/ledgers/passports/${encodeURIComponent(passportId)}/verify`),
        ]);

        if (!active) return;

        let entryData = [];
        if (entriesRes.status === 'fulfilled' && entriesRes.value.ok) {
          const parsedEntries = await readJsonSafe(entriesRes.value, '원장 이력 응답 형식이 올바르지 않습니다.');
          entryData = Array.isArray(parsedEntries) ? parsedEntries : [];
          setEntries(entryData);
        } else {
          setEntries([]);
          setLedgerError('원장 이력을 불러오지 못했습니다.');
        }

        const stateData = stateRes.status === 'fulfilled' && stateRes.value.ok
          ? await readJsonSafe(stateRes.value, '상태 응답 형식이 올바르지 않습니다.')
          : null;
        const ownerData = ownerRes.status === 'fulfilled' && ownerRes.value.ok
          ? await readJsonSafe(ownerRes.value, '소유자 응답 형식이 올바르지 않습니다.')
          : null;
        setDetail(buildLedgerBackedDetail(passportId, stateData, ownerData, entryData));

        if (verifyRes.status === 'fulfilled' && verifyRes.value.ok) {
          const verifyData = await readJsonSafe(verifyRes.value, '원장 검증 응답 형식이 올바르지 않습니다.');
          setVerification(verifyData || null);
        } else {
          setVerification(null);
        }
      } catch (e) {
        if (!active) return;
        setError(e?.message || '제품 상세 정보를 불러오지 못했습니다.');
      } finally {
        if (active) setLoading(false);
      }
    };

    load().catch(() => {});
    return () => {
      active = false;
    };
  }, [isOpen, passportId, accessToken]);

  const latestOwner = useMemo(() => {
    if (detail?.ownerId) return detail.ownerId;
    const latestOwnership = [...entries]
      .reverse()
      .find((entry) => String(entry?.event?.category || '').toUpperCase() === 'OWNERSHIP');
    return latestOwnership?.payload?.toOwnerId || null;
  }, [detail?.ownerId, entries]);

  const resolvedModelName = useMemo(() => {
    if (detail?.modelName) return detail.modelName;
    return findPayloadValue(entries, ['modelName', 'model_name', 'model']);
  }, [detail?.modelName, entries]);

  const resolvedSerialNumber = useMemo(() => {
    if (detail?.serialNumber) return detail.serialNumber;
    return findPayloadValue(entries, ['serialNumber', 'serial_number', 'serialNo', 'serial_no']);
  }, [detail?.serialNumber, entries]);

  const publicQrUrl = useMemo(() => {
    if (!passportId) return '';
    return `${window.location.origin}/products/passports/${encodeURIComponent(passportId)}`;
  }, [passportId]);

  useEffect(() => {
    if (!isOpen || !publicQrUrl) {
      setPublicQrImage('');
      setPublicQrLoading(false);
      return;
    }

    setPublicQrLoading(true);
    QRCode.toDataURL(publicQrUrl, {
      width: 180,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((dataUrl) => setPublicQrImage(dataUrl))
      .catch(() => setPublicQrImage(''))
      .finally(() => setPublicQrLoading(false));
  }, [isOpen, publicQrUrl]);

  const toggleExpand = (ledgerId) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(ledgerId)) next.delete(ledgerId);
      else next.add(ledgerId);
      return next;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-4xl overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              <ShieldCheck size={14} />
              제품 상세 정보
            </div>
            <h2 className="mt-2 text-xl font-bold text-gray-900">{resolvedModelName || passportId || '제품 상세'}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[80vh] overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="py-16 text-center text-sm text-gray-500">
              <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
              제품 상세 정보를 불러오는 중입니다.
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="mt-0.5" />
                <span>{error}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-xs font-semibold text-gray-500">모델명</div>
                  <div className="mt-1 text-base font-bold text-gray-900">{resolvedModelName || '-'}</div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-xs font-semibold text-gray-500">시리얼 번호</div>
                  <div className="mt-1 text-base font-bold text-gray-900">{resolvedSerialNumber || '-'}</div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-xs font-semibold text-gray-500">Passport ID</div>
                  <div className="mt-1 break-all font-mono text-xs text-gray-700">{detail?.passportId || passportId}</div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-xs font-semibold text-gray-500">현재 소유자</div>
                  <div className="mt-1 text-base font-bold text-gray-900">{maskId(latestOwner)}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-xs font-semibold text-gray-500">공개용 QR</div>
                <div className="mt-3 flex flex-col items-center gap-3">
                  {publicQrLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
                  ) : publicQrImage ? (
                    <img src={publicQrImage} alt="공개용 QR" className="h-36 w-36 rounded-lg border border-gray-200 bg-white p-2" />
                  ) : (
                    <div className="text-xs text-gray-500">QR 이미지를 불러오지 못했습니다.</div>
                  )}
                  <div className="break-all text-xs text-gray-500">{publicQrUrl}</div>
                </div>
              </div>

              {verification && (
                <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${verification.valid ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                  <CheckCircle2 size={14} />
                  {verification.valid ? '원장 무결성 검증 완료' : '원장 확인 필요'}
                </div>
              )}

              {ledgerError && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  {ledgerError}
                </div>
              )}

              <section className="space-y-3">
                <h3 className="text-lg font-bold text-gray-900">원장 이력</h3>
                {entries.length === 0 ? (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                    원장 이력이 없습니다.
                  </div>
                ) : (
                  entries.map((entry) => {
                    const expanded = expandedIds.has(entry.ledgerId);
                    return (
                      <article key={entry.ledgerId} className="rounded-2xl border border-gray-200 bg-white p-4">
                        <div className="text-sm font-semibold text-gray-900">{eventTitle(entry, entries)}</div>
                        <div className="mt-1 text-xs text-gray-500">{formatDateTime(entry.occurredAt)}</div>
                        <button
                          type="button"
                          onClick={() => toggleExpand(entry.ledgerId)}
                          className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-gray-700 hover:text-gray-900"
                        >
                          원장 상세 {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        {expanded && (
                          <pre className="mt-3 overflow-x-auto rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
                            {JSON.stringify(entry?.payload || {}, null, 2)}
                          </pre>
                        )}
                      </article>
                    );
                  })
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductPassportDetailModal;
