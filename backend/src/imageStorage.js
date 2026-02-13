import crypto from 'node:crypto';
import { config } from './config.js';
import { supabase } from './supabaseClient.js';
import { buildHttpError } from './helpers.js';

const DATA_URL_RE = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/;
const STORAGE_REF_PREFIX = 'storage:';
const MIME_TO_EXT = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

let bucketReadyPromise = null;
const signedUrlCache = new Map();
const SIGNED_URL_CACHE_MAX_ENTRIES = 8000;
const SIGNED_URL_CACHE_SAFETY_MS = 30 * 1000;

const pruneSignedUrlCache = () => {
  const now = Date.now();
  for (const [key, value] of signedUrlCache.entries()) {
    if (!value?.url || !value?.expiresAt || value.expiresAt <= now) {
      signedUrlCache.delete(key);
    }
  }
  while (signedUrlCache.size > SIGNED_URL_CACHE_MAX_ENTRIES) {
    const oldestKey = signedUrlCache.keys().next().value;
    if (!oldestKey) break;
    signedUrlCache.delete(oldestKey);
  }
};

const getCachedSignedUrl = (storageKey) => {
  if (!storageKey) return null;
  const hit = signedUrlCache.get(storageKey);
  if (!hit?.url || !hit?.expiresAt) return null;
  if (hit.expiresAt <= Date.now()) {
    signedUrlCache.delete(storageKey);
    return null;
  }
  return hit.url;
};

const saveSignedUrlCache = (storageKey, deliveryUrl, ttlSeconds) => {
  if (!storageKey || !deliveryUrl) return;
  const ttlMs = Math.max(5_000, Number(ttlSeconds || 0) * 1000 - SIGNED_URL_CACHE_SAFETY_MS);
  signedUrlCache.set(storageKey, {
    url: deliveryUrl,
    expiresAt: Date.now() + ttlMs,
  });
  pruneSignedUrlCache();
};

const normalizeErrorMessage = (error) => String(error?.message || error || '').toLowerCase();

const extractStorageKeyFromRef = (value) => {
  if (typeof value !== 'string') return null;
  if (!value.startsWith(STORAGE_REF_PREFIX)) return null;
  const key = value.slice(STORAGE_REF_PREFIX.length).trim();
  return key || null;
};

const buildDeliveryUrlForKey = async (key) => {
  if (!key || !config.imageBucket) return null;

  if (config.imageBucketPublic) {
    const { data } = supabase.storage.from(config.imageBucket).getPublicUrl(key);
    return data?.publicUrl || null;
  }

  const { data, error } = await supabase.storage
    .from(config.imageBucket)
    .createSignedUrl(key, config.imageSignedUrlTtlSeconds);
  if (error) throw error;
  return data?.signedUrl || null;
};

const ensureBucketReady = async () => {
  if (!config.imageStorageEnabled || !config.imageBucket) return false;
  if (bucketReadyPromise) return bucketReadyPromise;

  bucketReadyPromise = (async () => {
    const bucketName = config.imageBucket;
    const { data: bucket, error } = await supabase.storage.getBucket(bucketName);

    if (error) {
      const message = normalizeErrorMessage(error);
      const notFound =
        message.includes('not found') || message.includes('does not exist') || message.includes('404');

      if (!notFound) {
        throw error;
      }

      const { error: createError } = await supabase.storage.createBucket(bucketName, {
        public: config.imageBucketPublic,
        fileSizeLimit: '20MB',
      });
      if (createError) {
        const createMessage = normalizeErrorMessage(createError);
        const duplicate =
          createMessage.includes('already exists') || createMessage.includes('duplicate');
        if (!duplicate) {
          throw createError;
        }
      }
      return true;
    }

    if (bucket && bucket.public !== config.imageBucketPublic) {
      const { error: updateError } = await supabase.storage.updateBucket(bucketName, {
        public: config.imageBucketPublic,
      });
      if (updateError) throw updateError;
    }

    return true;
  })();

  return bucketReadyPromise;
};

const parseDataUrl = (image) => {
  if (typeof image !== 'string') return null;
  const match = image.match(DATA_URL_RE);
  if (!match) return null;
  return {
    mime: String(match[1] || '').toLowerCase(),
    base64: match[2] || '',
  };
};

const ensureDataUrlSizeWithinLimit = (parsed) => {
  if (!parsed) return;
  const bytes = Buffer.byteLength(parsed.base64 || '', 'base64');
  if (bytes <= 0) {
    throw buildHttpError(400, '图片内容为空');
  }
  if (bytes > config.maxImageBytes) {
    const maxMb = Math.floor(config.maxImageBytes / (1024 * 1024));
    throw buildHttpError(413, `图片过大，单张图片最大支持 ${maxMb}MB`);
  }
};

export const validateMemoryImageInput = (image) => {
  if (typeof image !== 'string' || !image.trim()) {
    throw buildHttpError(400, 'image is required');
  }
  const parsed = parseDataUrl(image);
  if (parsed) {
    ensureDataUrlSizeWithinLimit(parsed);
  }
};

export const toStorageRef = (storageKey) => {
  if (!storageKey) return '';
  return `${STORAGE_REF_PREFIX}${storageKey}`;
};

export const extractStorageKeyFromPublicUrl = (url) => {
  if (typeof url !== 'string' || !config.imageBucket) return null;
  const marker = `/storage/v1/object/public/${config.imageBucket}/`;
  const index = url.indexOf(marker);
  if (index < 0) return null;
  const rawKey = url.slice(index + marker.length).split('?')[0];
  return rawKey ? decodeURIComponent(rawKey) : null;
};

export const extractStorageKeyFromImage = (image) =>
  extractStorageKeyFromRef(image) || extractStorageKeyFromPublicUrl(image);

export const resolveMemoryImageUrl = async (image) => {
  if (typeof image !== 'string' || !image) return '';
  if (!config.imageStorageEnabled || !config.imageBucket) return image;

  const storageKey = extractStorageKeyFromImage(image);
  if (!storageKey) return image;

  const cached = getCachedSignedUrl(storageKey);
  if (cached) return cached;

  try {
    const resolved = await buildDeliveryUrlForKey(storageKey);
    if (resolved) {
      saveSignedUrlCache(
        storageKey,
        resolved,
        config.imageBucketPublic ? 24 * 60 * 60 : config.imageSignedUrlTtlSeconds
      );
    }
    return resolved || image;
  } catch (error) {
    console.warn('[memory-image-resolve] fallback to raw image value:', error?.message || error);
    return image;
  }
};

export const removeStoredMemoryImages = async (keys) => {
  if (!config.imageStorageEnabled || !config.imageBucket) return;
  const validKeys = (Array.isArray(keys) ? keys : []).filter(Boolean);
  if (validKeys.length === 0) return;
  const { error } = await supabase.storage.from(config.imageBucket).remove(validKeys);
  if (error) throw error;
  validKeys.forEach((key) => signedUrlCache.delete(key));
};

export const persistMemoryImageDetailed = async (image, userId) => {
  const parsed = parseDataUrl(image);
  if (!parsed) {
    return { image, uploaded: false, storageKey: null };
  }

  ensureDataUrlSizeWithinLimit(parsed);

  if (!config.imageStorageEnabled || !config.imageBucket) {
    return { image, uploaded: false, storageKey: null };
  }

  const ext = MIME_TO_EXT[parsed.mime] || 'jpg';
  const bytes = Buffer.from(parsed.base64, 'base64');
  if (!bytes.length) {
    throw buildHttpError(400, '图片内容为空');
  }

  await ensureBucketReady();

  const key = `memories/${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from(config.imageBucket).upload(key, bytes, {
    contentType: parsed.mime,
    upsert: false,
    cacheControl: '31536000',
  });

  if (uploadError) throw uploadError;

  const imageValue = toStorageRef(key);
  return {
    image: imageValue || image,
    uploaded: true,
    storageKey: key,
  };
};

export const persistMemoryImage = async (image, userId) => {
  const result = await persistMemoryImageDetailed(image, userId);
  return result.image;
};

export const persistAvatarImageDetailed = async (avatar, userId) => {
  const parsed = parseDataUrl(avatar);
  if (!parsed) {
    return { avatar, uploaded: false, storageKey: null };
  }

  ensureDataUrlSizeWithinLimit(parsed);

  if (!config.imageStorageEnabled || !config.imageBucket) {
    return { avatar, uploaded: false, storageKey: null };
  }

  const ext = MIME_TO_EXT[parsed.mime] || 'jpg';
  const bytes = Buffer.from(parsed.base64, 'base64');
  if (!bytes.length) {
    throw buildHttpError(400, '头像内容为空');
  }

  await ensureBucketReady();

  const key = `avatars/${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from(config.imageBucket).upload(key, bytes, {
    contentType: parsed.mime,
    upsert: false,
    cacheControl: '31536000',
  });

  if (uploadError) throw uploadError;

  const avatarValue = toStorageRef(key);
  return {
    avatar: avatarValue || avatar,
    uploaded: true,
    storageKey: key,
  };
};
