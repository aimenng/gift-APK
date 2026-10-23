import { getNow } from './timeService';

export interface ImageValidationResult {
  valid: boolean;
  errors: string[];
}

export interface PhotoMetadata {
  date: string;
  dateTime: string;
  source: 'exif' | 'file' | 'system';
}

export function validateFileSize(file: File, maxSizeMB: number = 5): boolean {
  const maxBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxBytes;
}

export function validateFileType(file: File): boolean {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  return validTypes.includes(file.type);
}

export function validateFiles(
  files: FileList | File[],
  maxCount: number = 100,
  maxSizeMB: number = 5
): ImageValidationResult {
  const errors: string[] = [];
  const fileArray = Array.from(files);

  if (fileArray.length > maxCount) {
    errors.push(`最多只能上传 ${maxCount} 张图片`);
  }

  fileArray.forEach((file, index) => {
    if (!validateFileType(file)) {
      errors.push(`第 ${index + 1} 张（${file.name}）格式不支持`);
    }
    if (!validateFileSize(file, maxSizeMB)) {
      errors.push(`第 ${index + 1} 张（${file.name}）超过 ${maxSizeMB}MB`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

export async function compressImage(
  file: File,
  maxSizeMB: number = 3,
  maxDimension: number = 1600
): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;

      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height / width) * maxDimension);
            width = maxDimension;
          } else {
            width = Math.round((width / height) * maxDimension);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Try multiple quality levels to keep payload small enough.
        const qualitySteps = [0.86, 0.78, 0.7, 0.62];
        const targetBytes = maxSizeMB * 1024 * 1024;

        const buildBlob = (qualityIndex: number) => {
          const quality = qualitySteps[Math.min(qualityIndex, qualitySteps.length - 1)];
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to compress image'));
                return;
              }

              if (blob.size > targetBytes && qualityIndex < qualitySteps.length - 1) {
                buildBlob(qualityIndex + 1);
                return;
              }

              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            },
            'image/jpeg',
            quality
          );
        };

        buildBlob(0);
      };

      img.onerror = () => reject(new Error('Failed to load image'));
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
  });
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}

const exifDateToIso = (value: string): string | null => {
  // Typical EXIF: 2024:02:09 13:45:10
  const m = value.match(
    /^(\d{4}):(\d{2}):(\d{2})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/
  );
  if (!m) return null;

  const year = m[1];
  const month = m[2];
  const day = m[3];
  const hh = m[4] || '00';
  const mm = m[5] || '00';
  const ss = m[6] || '00';
  return `${year}-${month}-${day}T${hh}:${mm}:${ss}`;
};

export async function extractExifDate(file: File): Promise<string | null> {
  const dateTime = await extractExifDateTime(file);
  return dateTime ? dateTime.slice(0, 10) : null;
}

export async function extractExifDateTime(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const view = new DataView(e.target?.result as ArrayBuffer);
        if (view.getUint16(0) !== 0xffd8) {
          resolve(null);
          return;
        }
        let offset = 2;
        while (offset < view.byteLength - 2) {
          const marker = view.getUint16(offset);
          offset += 2;

          if (marker === 0xffe1) {
            const exifHeader = String.fromCharCode(
              view.getUint8(offset + 2),
              view.getUint8(offset + 3),
              view.getUint8(offset + 4),
              view.getUint8(offset + 5)
            );
            if (exifHeader !== 'Exif') {
              resolve(null);
              return;
            }
            const tiffOffset = offset + 8;
            const littleEndian = view.getUint16(tiffOffset) === 0x4949;
            const ifdOffset = view.getUint32(tiffOffset + 4, littleEndian);
            const numEntries = view.getUint16(tiffOffset + ifdOffset, littleEndian);

            const readString = (strOffset: number, count: number) => {
              let str = '';
              for (let i = 0; i < count - 1; i += 1) {
                str += String.fromCharCode(view.getUint8(strOffset + i));
              }
              return str;
            };

            let exifIFDOffset: number | null = null;
            for (let i = 0; i < numEntries; i += 1) {
              const entryOffset = tiffOffset + ifdOffset + 2 + i * 12;
              const tag = view.getUint16(entryOffset, littleEndian);
              if (tag === 0x8769) {
                exifIFDOffset = view.getUint32(entryOffset + 8, littleEndian);
                break;
              }
              if (tag === 0x0132) {
                const count = view.getUint32(entryOffset + 4, littleEndian);
                const valueOffset = view.getUint32(entryOffset + 8, littleEndian);
                const dateStr = readString(tiffOffset + valueOffset, count);
                const iso = exifDateToIso(dateStr);
                if (iso) {
                  resolve(iso);
                  return;
                }
              }
            }

            if (exifIFDOffset !== null) {
              const exifEntries = view.getUint16(tiffOffset + exifIFDOffset, littleEndian);
              for (let i = 0; i < exifEntries; i += 1) {
                const entryOffset = tiffOffset + exifIFDOffset + 2 + i * 12;
                if (entryOffset + 12 > view.byteLength) break;
                const tag = view.getUint16(entryOffset, littleEndian);
                if (tag === 0x9003 || tag === 0x9004) {
                  const count = view.getUint32(entryOffset + 4, littleEndian);
                  const valueOffset = view.getUint32(entryOffset + 8, littleEndian);
                  const dateStr = readString(tiffOffset + valueOffset, count);
                  const iso = exifDateToIso(dateStr);
                  if (iso) {
                    resolve(iso);
                    return;
                  }
                }
              }
            }

            resolve(null);
            return;
          }

          if ((marker & 0xff00) === 0xff00) {
            const segLength = view.getUint16(offset);
            offset += segLength;
          } else {
            break;
          }
        }
        resolve(null);
      } catch {
        resolve(null);
      }
    };
    reader.onerror = () => resolve(null);
    reader.readAsArrayBuffer(file.slice(0, 131072));
  });
}

export async function getPhotoDate(file: File): Promise<string> {
  const metadata = await getPhotoMetadata(file);
  return metadata.date;
}

// Memory dates are wall-clock days for the user, so derive them from local components.
// toISOString() would shift any photo taken before the local UTC offset into the previous day.
const toLocalDateOnly = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export async function getPhotoMetadata(file: File): Promise<PhotoMetadata> {
  const exifDateTime = await extractExifDateTime(file);
  if (exifDateTime) {
    return {
      date: exifDateTime.slice(0, 10),
      dateTime: exifDateTime,
      source: 'exif',
    };
  }

  if (file.lastModified) {
    const d = new Date(file.lastModified);
    if (d.getFullYear() >= 2000 && d.getFullYear() <= 2100) {
      return {
        date: toLocalDateOnly(d),
        dateTime: d.toISOString(),
        source: 'file',
      };
    }
  }

  const now = getNow();
  return {
    date: now.format('YYYY-MM-DD'),
    dateTime: now.toISOString(),
    source: 'system',
  };
}

export function base64ToFile(base64: string, filename: string): File {
  const arr = base64.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);

  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }

  return new File([u8arr], filename, { type: mime });
}
