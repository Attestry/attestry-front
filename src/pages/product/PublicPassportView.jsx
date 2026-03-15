import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, Check, CheckCircle2, ChevronDown, ChevronUp, Copy, Loader2, ShieldCheck } from 'lucide-react';
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

const formatKst = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${formatter.format(date)} (KST)`;
};

const actorLabel = (entry) => {
  const actorId = String(entry?.actor?.id || '').trim();
  if (!actorId) return 'SYSTEM';
  if (actorId.toUpperCase() === 'SYSTEM') return 'SYSTEM';
  return actorId;
};

const actorRoleLabel = (entry) => {
  const actorRole = String(entry?.actor?.role || '').trim();
  return actorRole || '-';
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
  const normalizedKeys = keys.map((k) => String(k).toLowerCase());
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const payload = entries[i]?.payload;
    if (!payload || typeof payload !== 'object') continue;
    for (const [k, v] of Object.entries(payload)) {
      if (!normalizedKeys.includes(String(k).toLowerCase())) continue;
      const value = String(v ?? '').trim();
      if (value) return value;
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

const PublicPassportView = () => {
  const { passportId } = useParams();
  const accessToken = useAuthStore((state) => state.accessToken);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ledgerError, setLedgerError] = useState('');
  const [detail, setDetail] = useState(null);
  const [entries, setEntries] = useState([]);
  const [verification, setVerification] = useState(null);
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [copiedHash, setCopiedHash] = useState('');
  const [publicQrImage, setPublicQrImage] = useState('');
  const [publicQrLoading, setPublicQrLoading] = useState(false);
  const [publicQrError, setPublicQrError] = useState('');

  useEffect(() => {
    let active = true;
    const fetchWithAuth = (url) => (
      accessToken
        ? fetch(resolveApiUrl(url), { headers: { Authorization: `Bearer ${accessToken}` } })
        : fetch(resolveApiUrl(url))
    );
    const load = async () => {
      if (!passportId) {
        setError('유효하지 않은 디지털 자산입니다.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      setLedgerError('');

      try {
        const [stateRes, ownerRes, entriesRes, verifyRes] = await Promise.allSettled([
          fetchWithAuth(`/products/passports/${encodeURIComponent(passportId)}/state`),
          fetchWithAuth(`/products/passports/${encodeURIComponent(passportId)}/owner`),
          fetchWithAuth(`/ledgers/passports/${encodeURIComponent(passportId)}/entries`),
          fetchWithAuth(`/ledgers/passports/${encodeURIComponent(passportId)}/verify`),
        ]);

        if (!active) return;

        let entryData = [];
        if (entriesRes.status === 'fulfilled') {
          if (entriesRes.value.ok) {
            const parsedEntries = await readJsonSafe(entriesRes.value, '원장 이력 응답 형식이 올바르지 않습니다.');
            entryData = Array.isArray(parsedEntries) ? parsedEntries : [];
            setEntries(entryData);
          } else {
            setEntries([]);
            setLedgerError(`[${entriesRes.value.status}] 원장 이력을 불러오지 못했습니다.`);
          }
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
        const detailData = buildLedgerBackedDetail(passportId, stateData, ownerData, entryData);
        setDetail(detailData);

        if (verifyRes.status === 'fulfilled' && verifyRes.value.ok) {
          const verifyData = await readJsonSafe(verifyRes.value, '원장 검증 응답 형식이 올바르지 않습니다.');
          setVerification(verifyData || null);
        } else {
          setVerification(null);
        }

        const hasDetail = !!detailData?.passportId;
        const hasLedger = entriesRes.status === 'fulfilled' && entriesRes.value.ok;
        if (!hasDetail && !hasLedger) {
          throw new Error('공개 가능한 디지털 자산 또는 원장 이력이 없습니다.');
        }
      } catch (e) {
        if (!active) return;
        setError(e.message || '공개 디지털 자산 정보를 불러오지 못했습니다.');
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [passportId, accessToken]);

  const publicQrUrl = useMemo(() => {
    if (!passportId) return '';
    return `${window.location.origin}/products/passports/${encodeURIComponent(passportId)}`;
  }, [passportId]);

  useEffect(() => {
    if (!publicQrUrl) {
      setPublicQrImage('');
      setPublicQrError('');
      setPublicQrLoading(false);
      return;
    }
    setPublicQrLoading(true);
    setPublicQrError('');
    QRCode.toDataURL(publicQrUrl, {
      width: 220,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((dataUrl) => setPublicQrImage(dataUrl))
      .catch(() => {
        setPublicQrImage('');
        setPublicQrError('공개 QR 이미지 생성에 실패했습니다.');
      })
      .finally(() => setPublicQrLoading(false));
  }, [publicQrUrl]);

  const latestOwner = useMemo(() => {
    if (detail?.ownerId) return detail.ownerId;
    const latestOwnership = [...entries]
      .reverse()
      .find((entry) => String(entry?.event?.category || '').toUpperCase() === 'OWNERSHIP');
    const toOwner = latestOwnership?.payload?.toOwnerId;
    return toOwner || null;
  }, [detail?.ownerId, entries]);

  const resolvedModelName = useMemo(() => {
    if (detail?.modelName) return detail.modelName;
    return findPayloadValue(entries, ['modelName', 'model_name', 'model']);
  }, [detail?.modelName, entries]);

  const resolvedSerialNumber = useMemo(() => {
    if (detail?.serialNumber) return detail.serialNumber;
    return findPayloadValue(entries, ['serialNumber', 'serial_number', 'serialNo', 'serial_no']);
  }, [detail?.serialNumber, entries]);

  const toggleExpand = (ledgerId) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(ledgerId)) next.delete(ledgerId);
      else next.add(ledgerId);
      return next;
    });
  };

  const copyHash = async (hash) => {
    if (!hash) return;
    try {
      await navigator.clipboard.writeText(hash);
      setCopiedHash(hash);
      setTimeout(() => setCopiedHash(''), 1500);
    } catch {
      // noop
    }
  };

  if (loading) {
    return (
      <div className="tracera-page-shell min-h-[calc(100vh-4rem)]">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="tracera-page-card p-12 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-slate-500" />
          <p className="mt-4 text-slate-600">공개 디지털 자산 원장 정보를 불러오는 중입니다.</p>
        </div>
      </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tracera-page-shell min-h-[calc(100vh-4rem)]">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="tracera-page-card border border-red-200 bg-red-50 p-8">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-red-600 mt-0.5" />
            <div>
              <p className="font-semibold text-red-800">공개 디지털 자산 조회에 실패했습니다.</p>
              <p className="mt-1 text-sm text-red-700">{error}</p>
              <Link to="/" className="mt-4 inline-flex text-sm font-semibold text-red-800 underline underline-offset-4">
                메인으로 돌아가기
              </Link>
            </div>
          </div>
        </div>
      </div>
      </div>
    );
  }

  return (
    <div className="tracera-page-shell min-h-[calc(100vh-4rem)]">
      <div className="mx-auto max-w-5xl space-y-7 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <section className="tracera-page-hero">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="tracera-page-tag">
                <ShieldCheck className="h-4 w-4" />
                PUBLIC PASSPORT
              </div>
              <h1 className="tracera-keepall mt-4 text-3xl font-semibold tracking-[-0.055em] text-slate-950 sm:text-[2.45rem]">스캔으로 신뢰를 확인하는 공개 디지털 여권</h1>
              <p className="tracera-keepall mt-3 max-w-2xl text-sm leading-7 text-slate-600">제품의 핵심 이력과 원장 검증 상태를 외부에서도 같은 톤으로 읽을 수 있게 정리했습니다.</p>
            </div>
            {verification && (
              <div className={`inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1 text-xs font-bold ring-1 ${verification.valid ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-amber-50 text-amber-700 ring-amber-200'
                }`}>
                <CheckCircle2 className="h-4 w-4" />
                {verification.valid ? '원장 무결성 검증 완료' : '원장 무결성 확인 필요'}
              </div>
            )}
          </div>

          <div className="mt-7 grid gap-4 md:grid-cols-2">
            <div className="tracera-page-card-soft p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Model</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{resolvedModelName || '-'}</p>
            </div>
            <div className="tracera-page-card-soft p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">등록 번호</p>
              <p className="mt-1 text-sm font-semibold text-slate-900 break-all">{resolvedSerialNumber || '-'}</p>
            </div>
            <div className="tracera-page-card-soft p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Passport ID</p>
              <p className="mt-1 text-xs font-mono text-slate-700 break-all">{detail?.passportId || '-'}</p>
            </div>
            <div className="tracera-page-card-soft p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">현재 소유자</p>
              <p className="mt-1 text-base font-bold text-slate-900 break-all">{latestOwner || '-'}</p>
            </div>
          </div>

          <div className="tracera-page-card-soft mt-6 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">공개 QR (고정)</p>
            <div className="mt-3 flex flex-col items-center gap-3">
              {publicQrLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
              ) : publicQrError ? (
                <p className="text-sm text-red-600">{publicQrError}</p>
              ) : publicQrImage ? (
                <img src={publicQrImage} alt="공개 QR" className="h-44 w-44 rounded-lg border border-slate-200 bg-white p-2" />
              ) : null}
              <p className="text-xs text-slate-500 break-all">{publicQrUrl}</p>
            </div>
          </div>
        </section>

        <section className="tracera-page-card p-7">
          <h2 className="text-xl font-extrabold text-slate-900">제품 생애 주기 이력</h2>
          <p className="mt-2 text-sm text-slate-500">
            이 제품의 제조부터 현재까지의 모든 중요 기록은 암호화되어 안전하게 보관됩니다.
          </p>
          {ledgerError && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              {ledgerError}
            </div>
          )}

          <div className="mt-6 space-y-4">
            {entries.length > 0 ? (
              entries.map((entry) => {
                const expanded = expandedIds.has(entry.ledgerId);
                const hash = entry?.integrity?.entryHash || '-';
                return (
                  <article key={entry.ledgerId} className="tracera-page-card-soft p-5">
                    <p className="text-sm font-semibold text-slate-700">{formatKst(entry.occurredAt)}</p>
                    <h3 className="mt-1 text-lg font-bold text-slate-900">{eventTitle(entry, entries)}</h3>

                    <div className="mt-3 grid gap-2 text-sm text-slate-700">
                      <p className="break-all"><span className="font-semibold">수행자 ID:</span> {actorLabel(entry)}</p>
                      <p><span className="font-semibold">수행자 역할:</span> {actorRoleLabel(entry)}</p>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">증명 요약:</span>
                        <span className="font-mono text-xs break-all text-slate-800">{hash}</span>
                        <button
                          type="button"
                          onClick={() => copyHash(hash)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          {copiedHash === hash ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          {copiedHash === hash ? '복사됨' : '복사'}
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleExpand(entry.ledgerId)}
                      className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-slate-700 hover:text-slate-900"
                    >
                      원장 상세 정보 {expanded ? '▲' : '▼'}
                      {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>

                    {expanded && (
                      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 space-y-3">
                        <div>
                          <p className="font-semibold text-slate-900">Transaction Hash:</p>
                          <p className="mt-1 font-mono text-xs break-all">{entry?.integrity?.entryHash || '-'}</p>
                        </div>
                        {entry?.integrity?.prevHash && (
                          <div>
                            <p className="font-semibold text-slate-900">Previous Hash:</p>
                            <p className="mt-1 font-mono text-xs break-all">{entry.integrity.prevHash}</p>
                          </div>
                        )}
                        {entry?.payload?.correlationId && (
                          <div>
                            <p className="font-semibold text-slate-900">Correlation ID:</p>
                            <p className="mt-1 font-mono text-xs break-all">{entry.payload.correlationId}</p>
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-slate-900">Data Payload:</p>
                          <pre className="mt-1 overflow-x-auto rounded-lg bg-white p-3 text-xs text-slate-800 border border-slate-200">
                            {JSON.stringify(entry?.payload || {}, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
                공개 가능한 원장 이력이 아직 없습니다.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default PublicPassportView;
