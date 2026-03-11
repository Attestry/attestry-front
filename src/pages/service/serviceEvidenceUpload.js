const toSha256Hex = async (file) => {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

export const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

export const uploadEvidenceFiles = async ({
  files,
  initialEvidenceGroupId,
  presign,
  complete,
  onProgress,
}) => {
  let evidenceGroupId = initialEvidenceGroupId || null;
  const uploadedFiles = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const contentType = file.type || 'application/octet-stream';

    onProgress?.({
      total: files.length,
      done: index,
      current: file.name,
    });

    const presigned = await presign({
      evidenceGroupId,
      fileName: file.name,
      contentType,
    });

    const uploadResponse = await fetch(presigned.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: file,
    });
    if (!uploadResponse.ok) {
      throw new Error(`${file.name}: 첨부 업로드에 실패했습니다.`);
    }

    const fileHash = await toSha256Hex(file);
    const completed = await complete({
      evidenceGroupId: presigned.evidenceGroupId,
      evidenceId: presigned.evidenceId,
      sizeBytes: file.size,
      fileHash,
    });

    evidenceGroupId = presigned.evidenceGroupId;
    uploadedFiles.push({
      evidenceId: completed.evidenceId,
      fileName: file.name,
      sizeBytes: file.size,
      status: completed.status,
    });

    onProgress?.({
      total: files.length,
      done: index + 1,
      current: file.name,
    });
  }

  return {
    evidenceGroupId,
    uploadedFiles,
  };
};
