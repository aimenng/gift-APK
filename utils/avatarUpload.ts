import { compressImage, fileToBase64, validateFileType } from './imageUpload';

const AVATAR_SOURCE_MAX_MB = 12;
// Keep a safety margin below backend MAX_AVATAR_LENGTH (default: 240_000)
// to avoid save failures caused by local compression passing but server reject.
const AVATAR_MAX_DATA_URL_LENGTH = 220_000;
const AVATAR_TARGETS = [
  { maxSizeMB: 0.22, maxDimension: 960, maxDataUrlLength: AVATAR_MAX_DATA_URL_LENGTH },
  { maxSizeMB: 0.16, maxDimension: 720, maxDataUrlLength: 205_000 },
  { maxSizeMB: 0.11, maxDimension: 560, maxDataUrlLength: 188_000 },
  { maxSizeMB: 0.08, maxDimension: 420, maxDataUrlLength: 170_000 },
];

const isDataUrl = (value: string) => /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(value);

export const validateAvatarSourceFile = (file: File): string | null => {
  if (!validateFileType(file)) {
    return '仅支持 JPG / PNG / WEBP / GIF 格式头像';
  }
  if (file.size > AVATAR_SOURCE_MAX_MB * 1024 * 1024) {
    return `头像原图不能超过 ${AVATAR_SOURCE_MAX_MB}MB`;
  }
  return null;
};

export const buildAvatarDataUrl = async (file: File): Promise<string> => {
  for (const target of AVATAR_TARGETS) {
    const compressed = await compressImage(file, target.maxSizeMB, target.maxDimension);
    const dataUrl = await fileToBase64(compressed);
    if (isDataUrl(dataUrl) && dataUrl.length <= target.maxDataUrlLength) {
      return dataUrl;
    }
  }
  throw new Error('图片过大，请换一张更小的图片或先裁剪后再上传');
};
