// 첨부 사진 처리. 브라우저에서 줄여서 base64로 보내고, 서버는 형식·크기만 검증한다.
export type ImageInput = { mime: string; data: string };

export const MAX_IMAGES = 4;
export const MAX_IMAGE_BASE64 = 2_800_000; // 약 2MB 원본. 클라이언트에서 축소해 보낸다.
export const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function validateImages(raw: unknown): ImageInput[] | string {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) return '사진 형식이 올바르지 않아요.';
  if (raw.length > MAX_IMAGES) return `사진은 ${MAX_IMAGES}장까지 올릴 수 있어요.`;
  const out: ImageInput[] = [];
  for (const item of raw) {
    const mime = typeof item?.mime === 'string' ? item.mime : '';
    const data = typeof item?.data === 'string' ? item.data : '';
    if (!ALLOWED_MIME.has(mime)) return '사진은 JPEG, PNG, WEBP만 올릴 수 있어요.';
    if (!data || data.length > MAX_IMAGE_BASE64) return '사진 한 장이 너무 커요. 화면을 잘라서 올려 주세요.';
    if (!/^[A-Za-z0-9+/=]+$/.test(data)) return '사진 데이터가 손상됐어요.';
    out.push({ mime, data });
  }
  return out;
}

export function isImageFile(file: File) {
  return ALLOWED_MIME.has(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
}

// 브라우저 전용. 긴 변 1600px 이하 JPEG로 줄인다.
export async function downscaleImage(file: File, maxSide = 1600, quality = 0.85): Promise<ImageInput> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  return { mime: 'image/jpeg', data: dataUrl.slice(dataUrl.indexOf(',') + 1) };
}

// 클립보드나 드래그에 든 이미지 파일만 골라낸다. 텍스트 붙여넣기는 그대로 둔다.
export function imageFilesFrom(dt: DataTransfer | null): File[] {
  if (!dt) return [];
  const files = Array.from(dt.files ?? []);
  const fromItems = Array.from(dt.items ?? []).filter(i => i.kind === 'file' && i.type.startsWith('image/')).map(i => i.getAsFile()).filter((f): f is File => !!f);
  const all = files.length ? files : fromItems;
  return all.filter(f => f.type.startsWith('image/'));
}
