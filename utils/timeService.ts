/**
 * 网络时间同步服务
 * 从公共时间API校准本地时钟，确保纪念日计算准确
 */
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

// 本地时钟与服务器时钟的偏移量（毫秒）
let _timeOffset = 0;
let _synced = false;
let _syncPromise: Promise<void> | null = null;

// 同步回调列表 —— 让组件可以监听同步完成
type SyncListener = (synced: boolean) => void;
const _listeners: Set<SyncListener> = new Set();

export const onSyncChange = (fn: SyncListener) => {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
};

const notifyListeners = () => {
  _listeners.forEach(fn => fn(_synced));
};

/**
 * 从多个公共时间API获取准确时间，计算偏移量
 * 采用 request-midpoint 算法减少网络延迟误差
 */
export const syncTime = async (): Promise<void> => {
  // 避免重复请求
  if (_syncPromise) return _syncPromise;

  _syncPromise = (async () => {
    const apis = [
      {
        url: 'https://worldtimeapi.org/api/ip',
        parse: (json: any) => new Date(json.datetime).getTime(),
      },
      {
        url: 'https://timeapi.io/api/time/current/zone?timeZone=Asia/Shanghai',
        parse: (json: any) => {
          // timeapi.io 返回 { dateTime: "2025-01-15T12:34:56.789" } 无时区
          // 需要加上对应时区偏移（Asia/Shanghai = +08:00）
          return new Date(json.dateTime + '+08:00').getTime();
        },
      },
    ];

    for (const api of apis) {
      try {
        const t0 = Date.now();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const res = await fetch(api.url, { signal: controller.signal });
        clearTimeout(timeout);

        const t1 = Date.now();
        // A 4xx/5xx body is HTML rather than JSON, so res.json() would throw and fall
        // through anyway — saying so explicitly keeps the real reason in the logs.
        if (!res.ok) {
          console.warn(`[TimeSync] ⚠️ ${api.url} 返回 HTTP ${res.status}，尝试下一个...`);
          continue;
        }
        const json = await res.json();
        const serverMs = api.parse(json);

        if (isNaN(serverMs)) continue;

        // 取请求中间时刻作为本地对应时间
        const localMid = (t0 + t1) / 2;
        _timeOffset = serverMs - localMid;
        _synced = true;

        console.log(
          `[TimeSync] ✅ 校准成功 | 偏移: ${_timeOffset > 0 ? '+' : ''}${_timeOffset}ms | 来源: ${api.url}`
        );
        console.log(
          `[TimeSync]    本地时间: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`,
          `| 校准时间: ${dayjs(Date.now() + _timeOffset).format('YYYY-MM-DD HH:mm:ss')}`
        );
        notifyListeners();
        return;
      } catch (err) {
        console.warn(`[TimeSync] ⚠️ ${api.url} 请求失败，尝试下一个...`);
      }
    }

    // 所有API都失败了，使用本地时间
    console.warn('[TimeSync] ❌ 所有时间API均不可用，使用本地时间');
    _timeOffset = 0;
    _synced = false;
    notifyListeners();
  })();

  try {
    await _syncPromise;
  } finally {
    _syncPromise = null;
  }
};

/**
 * 获取校准后的当前时间
 * 如果已同步，返回经偏移校准的时间；否则返回本地时间
 */
export const getNow = (): dayjs.Dayjs => {
  return dayjs(Date.now() + _timeOffset);
};

/**
 * 获取校准后的当前日期字符串 (YYYY-MM-DD)
 */
export const getTodayStr = (): string => {
  return getNow().format('YYYY-MM-DD');
};

/** 是否已完成时间同步 */
export const isSynced = (): boolean => _synced;

/** 当前偏移量（毫秒） */
export const getOffset = (): number => _timeOffset;
