export const SERVICE_TYPE_OPTIONS = [
  { value: 'REPAIR', label: '수리' },
  { value: 'CLEANING', label: '클리닝' },
  { value: 'INSPECTION', label: '점검' },
  { value: 'MAINTENANCE', label: '유지보수' },
  { value: 'AUTHENTICATION', label: '진위 확인' },
];

export const COMPLETION_SERVICE_TYPE_OPTIONS = SERVICE_TYPE_OPTIONS.filter((option) => option.value !== 'AUTHENTICATION');

export const getDefaultServiceResult = (serviceType) => {
  if (serviceType === 'REPAIR') return '수리 완료';
  if (serviceType === 'CLEANING') return '클리닝 완료';
  if (serviceType === 'INSPECTION') return '점검 완료';
  if (serviceType === 'MAINTENANCE') return '유지보수 완료';
  return '서비스 완료';
};

export const SERVICE_REQUEST_METHOD_OPTIONS = [
  { value: 'ONLINE', label: '온라인 요청' },
  { value: 'VISIT', label: '직접 방문' },
];

export const getServiceTypeLabel = (value) =>
  SERVICE_TYPE_OPTIONS.find((option) => option.value === value)?.label || value || '-';

export const getServiceRequestMethodLabel = (value) =>
  SERVICE_REQUEST_METHOD_OPTIONS.find((option) => option.value === value)?.label || value || '-';

export const toApiDateTime = (localDateTime) => {
  if (!localDateTime) return null;
  const date = new Date(localDateTime);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

export const toDateTimeLocalValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};
