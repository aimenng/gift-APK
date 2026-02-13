import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { Memory, AnniversaryEvent, YearStat } from './types';
import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from './utils/apiClient';
import { getAuthToken } from './utils/authToken';
import { onSessionSync, triggerSessionSync } from './utils/sessionSync';
import { getNow } from './utils/timeService';

interface ConnectResult {
  ok: boolean;
  pending?: boolean;
  message?: string;
}

interface PendingBindingRequest {
  id: string;
  inviteCode: string;
  createdAt: string;
  expiresAt: string;
  requester: {
    id: string;
    name: string;
    email: string;
    invitationCode: string;
  };
}

interface AppContextType {
  memories: Memory[];
  yearStats: YearStat[];
  addMemory: (memory: Omit<Memory, 'id' | 'rotation'>) => Promise<void>;
  addMemoriesBatch: (memories: Array<Omit<Memory, 'id' | 'rotation'>>) => Promise<number>;
  updateMemory: (id: string, updates: Partial<Omit<Memory, 'id'>>) => Promise<void>;
  deleteMemory: (id: string) => Promise<void>;
  events: AnniversaryEvent[];
  addEvent: (event: Omit<AnniversaryEvent, 'id'>) => Promise<void>;
  updateEvent: (id: string, updates: Partial<Omit<AnniversaryEvent, 'id'>>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  togetherDate: string;
  updateTogetherDate: (date: string) => Promise<void>;
  isConnected: boolean;
  inviteCode: string | null;
  boundInviteCode: string | null;
  connect: (code: string) => Promise<ConnectResult>;
  disconnect: () => Promise<void>;
  pendingBindingRequests: PendingBindingRequest[];
  refreshPendingBindingRequests: () => Promise<void>;
  respondBindingRequest: (requestId: string, action: 'accept' | 'reject') => Promise<ConnectResult>;
}

interface AppStateResponse {
  memories: Memory[];
  yearStats?: YearStat[];
  events: AnniversaryEvent[];
  memoryPagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  settings: {
    togetherDate: string;
    isConnected: boolean;
    inviteCode: string | null;
    boundInviteCode: string | null;
  };
}

interface MemoriesPageResponse {
  memories: Memory[];
  memoryPagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

interface PendingBindingsResponse {
  requests: PendingBindingRequest[];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const DEFAULT_CONNECTION = {
  isConnected: false,
  inviteCode: null as string | null,
  boundInviteCode: null as string | null,
  togetherDate: '2021-10-12',
};
type CloudSyncMode = 'full' | 'light';

const CLOUD_SYNC_PAGE_SIZE = 30;
const CLOUD_EXTRA_PAGE_FETCH_CHUNK_SIZE = 8;
const CLOUD_FULL_SYNC_COOLDOWN_MS = 5 * 60 * 1000;
const CLOUD_SYNC_INTERVAL_CONNECTED_MS = 45_000;
const CLOUD_SYNC_INTERVAL_DISCONNECTED_MS = 20_000;
const CLOUD_MEMORY_BATCH_PAYLOAD_SOFT_LIMIT = 8 * 1024 * 1024;
const CLOUD_MEMORY_BATCH_MAX_ITEMS_PER_REQUEST = 4;

const createLocalMemory = (newMemory: Omit<Memory, 'id' | 'rotation'>): Memory => ({
  ...newMemory,
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  rotation: Math.random() > 0.5 ? 'rotate-1' : '-rotate-1',
});

const getMemoryYear = (dateValue: string): string => String(dateValue || '').slice(0, 4);
const isValidYear = (year: string): boolean => /^\d{4}$/.test(year);

const computeYearStatsFromMemories = (items: Memory[]): YearStat[] => {
  const groups: Record<string, YearStat> = {};

  for (const memory of items) {
    const year = getMemoryYear(memory.date);
    if (!isValidYear(year)) continue;

    if (!groups[year]) {
      groups[year] = {
        year,
        count: 0,
        coverMemoryId: memory.id,
      };
    }

    groups[year].count += 1;
  }

  return Object.values(groups).sort((a, b) => b.year.localeCompare(a.year));
};

const parseEventCreatedAt = (event: AnniversaryEvent): number => {
  const ts = Date.parse(event.createdAt || '');
  return Number.isNaN(ts) ? 0 : ts;
};

const dedupeRecentDuplicateEvents = (items: AnniversaryEvent[]): AnniversaryEvent[] => {
  if (!Array.isArray(items) || items.length <= 1) return items || [];

  const dedupeWindowMs = 30_000;
  const ordered = [...items].sort((a, b) => {
    const diff = parseEventCreatedAt(b) - parseEventCreatedAt(a);
    if (diff !== 0) return diff;
    return String(b.id).localeCompare(String(a.id));
  });

  const lastCreatedAtByFingerprint = new Map<string, number>();
  const deduped: AnniversaryEvent[] = [];

  for (const event of ordered) {
    const fingerprint = [
      event.userId || '',
      event.type || '',
      event.title || '',
      event.subtitle || '',
      event.date || '',
      event.image || '',
    ].join('|');

    const createdAtTs = parseEventCreatedAt(event);
    const lastTs = lastCreatedAtByFingerprint.get(fingerprint);
    const isDuplicate =
      lastTs != null &&
      (createdAtTs === 0 || lastTs === 0 || Math.abs(lastTs - createdAtTs) <= dedupeWindowMs);

    if (isDuplicate) continue;

    deduped.push(event);
    lastCreatedAtByFingerprint.set(fingerprint, createdAtTs || 0);
  }

  return deduped;
};

const mergeNewestFirstMemories = (latestPage: Memory[], existing: Memory[]): Memory[] => {
  const merged: Memory[] = [];
  const seen = new Set<string>();

  for (const item of latestPage) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }

  for (const item of existing) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }

  return merged;
};

const estimatePayloadBytes = (payload: unknown): number => {
  try {
    return new Blob([JSON.stringify(payload)]).size;
  } catch {
    return JSON.stringify(payload).length;
  }
};

const isPayloadTooLargeError = (error: any): boolean => {
  const status = Number(error?.status);
  if (status === 413) return true;
  const message = String(error?.message || '').toLowerCase();
  return message.includes('payload too large') || message.includes('entity too large') || message.includes('request too large');
};

const buildAdaptiveMemoryChunks = (items: Array<Omit<Memory, 'id' | 'rotation'>>) => {
  const chunks: Array<Array<Omit<Memory, 'id' | 'rotation'>>> = [];
  let current: Array<Omit<Memory, 'id' | 'rotation'>> = [];

  for (const item of items) {
    const candidate = [...current, item];
    const payloadBytes = estimatePayloadBytes({ memories: candidate });
    const overflowCount = candidate.length > CLOUD_MEMORY_BATCH_MAX_ITEMS_PER_REQUEST;
    const overflowSize = payloadBytes > CLOUD_MEMORY_BATCH_PAYLOAD_SOFT_LIMIT;
    if (current.length > 0 && (overflowCount || overflowSize)) {
      chunks.push(current);
      current = [item];
    } else {
      current = candidate;
    }
  }

  if (current.length > 0) chunks.push(current);
  return chunks;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [yearStats, setYearStats] = useState<YearStat[]>([]);
  const [events, setEvents] = useState<AnniversaryEvent[]>([]);
  const [connectionState, setConnectionState] = useState<{
    isConnected: boolean;
    inviteCode: string | null;
    boundInviteCode: string | null;
    togetherDate: string;
  }>(DEFAULT_CONNECTION);
  const [hasCloudSession, setHasCloudSession] = useState<boolean>(() => Boolean(getAuthToken()));
  const [pendingBindingRequests, setPendingBindingRequests] = useState<PendingBindingRequest[]>([]);
  const syncInFlightRef = useRef(false);
  const syncQueuedRef = useRef(false);
  const syncEpochRef = useRef(0);
  const lastFullSyncAtRef = useRef(0);

  const refreshPendingBindingRequests = async () => {
    const token = getAuthToken();
    if (!token) {
      setPendingBindingRequests([]);
      return;
    }

    try {
      const result = await apiGet<PendingBindingsResponse>('/bindings/pending');
      setPendingBindingRequests(result.requests || []);
    } catch (error) {
      console.error('Failed to load pending binding requests:', error);
    }
  };

  const syncFromCloud = async (mode: CloudSyncMode = 'full') => {
    if (syncInFlightRef.current) {
      syncQueuedRef.current = true;
      return;
    }
    syncInFlightRef.current = true;
    const syncEpoch = syncEpochRef.current + 1;
    syncEpochRef.current = syncEpoch;

    try {
      const token = getAuthToken();
      setHasCloudSession(Boolean(token));
      if (!token) {
        setMemories([]);
        setYearStats([]);
        setEvents([]);
        setConnectionState(DEFAULT_CONNECTION);
        setPendingBindingRequests([]);
        return;
      }

      const shouldRunFullSync =
        mode === 'full' || Date.now() - lastFullSyncAtRef.current >= CLOUD_FULL_SYNC_COOLDOWN_MS;
      const [firstPage, pendingResult] = await Promise.all([
        apiGet<AppStateResponse>(`/app/state?page=1&limit=${CLOUD_SYNC_PAGE_SIZE}&includeYearStats=0`),
        apiGet<PendingBindingsResponse>('/bindings/pending').catch(() => ({ requests: [] })),
      ]);
      if (syncEpochRef.current !== syncEpoch) return;

      const firstPageMemories = [...(firstPage.memories || [])];
      const totalPages = Math.max(1, firstPage.memoryPagination?.totalPages || 1);
      const pagesToFetch = Array.from({ length: Math.max(0, totalPages - 1) }, (_, idx) => idx + 2);
      const serverYearStats =
        firstPage.yearStats && firstPage.yearStats.length > 0 ? firstPage.yearStats : null;

      // Hydrate critical data immediately for fast first paint.
      if (shouldRunFullSync) {
        setMemories(firstPageMemories);
        setYearStats(serverYearStats || computeYearStatsFromMemories(firstPageMemories));
      } else {
        setMemories((prev) => {
          const merged = mergeNewestFirstMemories(firstPageMemories, prev);
          if (!serverYearStats) {
            setYearStats(computeYearStatsFromMemories(merged));
          }
          return merged;
        });
        if (serverYearStats) {
          setYearStats(serverYearStats);
        }
      }
      setEvents(dedupeRecentDuplicateEvents(firstPage.events || []));
      setPendingBindingRequests(pendingResult.requests || []);
      if (firstPage.settings) {
        setConnectionState({
          isConnected: Boolean(firstPage.settings.isConnected),
          inviteCode: firstPage.settings.inviteCode || null,
          boundInviteCode: firstPage.settings.boundInviteCode || null,
          togetherDate: firstPage.settings.togetherDate || DEFAULT_CONNECTION.togetherDate,
        });
      }

      if (!shouldRunFullSync || pagesToFetch.length === 0) {
        return;
      }
      lastFullSyncAtRef.current = Date.now();

      // Fetch extra pages in background to keep login/navigation responsive.
      void (async () => {
        const allMemories = [...firstPageMemories];
        for (let i = 0; i < pagesToFetch.length; i += CLOUD_EXTRA_PAGE_FETCH_CHUNK_SIZE) {
          if (syncEpochRef.current !== syncEpoch) return;
          const chunk = pagesToFetch.slice(i, i + CLOUD_EXTRA_PAGE_FETCH_CHUNK_SIZE);
          const chunkResults = await Promise.all(
            chunk.map((page) =>
              apiGet<MemoriesPageResponse>(
                `/memories?page=${page}&limit=${CLOUD_SYNC_PAGE_SIZE}&includeCount=0`
              )
            )
          );
          chunkResults.forEach((next) => {
            allMemories.push(...(next.memories || []));
          });
        }

        if (syncEpochRef.current !== syncEpoch) return;
        if (allMemories.length !== firstPageMemories.length) {
          setMemories(allMemories);
          if (!serverYearStats) {
            setYearStats(computeYearStatsFromMemories(allMemories));
          }
        }
      })().catch((error) => {
        console.error('Failed to hydrate extra memory pages:', error);
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setHasCloudSession(false);
        setMemories([]);
        setYearStats([]);
        setEvents([]);
        setConnectionState(DEFAULT_CONNECTION);
        setPendingBindingRequests([]);
      }
      console.error('Failed to sync cloud app state:', error);
    } finally {
      syncInFlightRef.current = false;
      if (syncQueuedRef.current) {
        syncQueuedRef.current = false;
        void syncFromCloud('full');
      }
    }
  };

  useEffect(() => {
    void syncFromCloud('full');
    return onSessionSync(() => {
      void syncFromCloud('full');
    });
  }, []);

  useEffect(() => {
    if (!hasCloudSession) return;
    const syncIntervalMs = connectionState.isConnected
      ? CLOUD_SYNC_INTERVAL_CONNECTED_MS
      : CLOUD_SYNC_INTERVAL_DISCONNECTED_MS;

    const runLightSync = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      void syncFromCloud('light');
    };

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void syncFromCloud('light');
      }
    };

    const timer = window.setInterval(runLightSync, syncIntervalMs);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    return () => {
      window.clearInterval(timer);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [hasCloudSession, connectionState.isConnected]);

  const addMemory = async (newMemory: Omit<Memory, 'id' | 'rotation'>) => {
    if (!hasCloudSession) {
      throw new Error('请先登录后再上传回忆');
    }

    const optimistic = createLocalMemory(newMemory);

    // Optimistic: insert immediately with temporary id
    setMemories((prev) => {
      const next = [optimistic, ...prev];
      setYearStats(computeYearStatsFromMemories(next));
      return next;
    });

    try {
      const response = await apiPost<{ memory: Memory }>('/memories', newMemory);
      // Replace optimistic entry with server-confirmed entry
      setMemories((prev) => {
        const replaced = prev.map((m) => (m.id === optimistic.id ? response.memory : m));
        const deduped: Memory[] = [];
        const seen = new Set<string>();
        for (const item of replaced) {
          if (seen.has(item.id)) continue;
          seen.add(item.id);
          deduped.push(item);
        }
        setYearStats(computeYearStatsFromMemories(deduped));
        return deduped;
      });
    } catch (error) {
      console.error('addMemory cloud failed, rollback optimistic entry:', error);
      setMemories((prev) => {
        const next = prev.filter((m) => m.id !== optimistic.id);
        setYearStats(computeYearStatsFromMemories(next));
        return next;
      });
      throw error;
    }
  };

  const addMemoriesBatch = async (items: Array<Omit<Memory, 'id' | 'rotation'>>) => {
    if (!items.length) return 0;
    if (!hasCloudSession) {
      throw new Error('请先登录后再上传回忆');
    }

    const uploadChunk = async (
      chunk: Array<Omit<Memory, 'id' | 'rotation'>>
    ): Promise<Memory[]> => {
      try {
        const response = await apiPost<{ memories: Memory[] }>('/memories/batch', {
          memories: chunk,
        });
        return response.memories || [];
      } catch (error: any) {
        if (isPayloadTooLargeError(error) && chunk.length > 1) {
          const mid = Math.ceil(chunk.length / 2);
          const [left, right] = await Promise.all([
            uploadChunk(chunk.slice(0, mid)),
            uploadChunk(chunk.slice(mid)),
          ]);
          return [...left, ...right];
        }
        throw error;
      }
    };

    let insertedCount = 0;
    try {
      const chunks = buildAdaptiveMemoryChunks(items);

      for (const chunk of chunks) {
        // eslint-disable-next-line no-await-in-loop
        const inserted = await uploadChunk(chunk);
        if (inserted.length === 0) continue;
        insertedCount += inserted.length;
        setMemories((prev) => {
          const merged = [...inserted, ...prev];
          const deduped: Memory[] = [];
          const seen = new Set<string>();
          for (const item of merged) {
            if (seen.has(item.id)) continue;
            seen.add(item.id);
            deduped.push(item);
          }
          setYearStats(computeYearStatsFromMemories(deduped));
          return deduped;
        });
      }

      return insertedCount;
    } catch (error: any) {
      console.error('addMemoriesBatch cloud failed:', error);
      if (insertedCount > 0) {
        throw new Error(`${error?.message || '批量上传中断'}（已成功上传 ${insertedCount} 张）`);
      }
      throw error;
    }
  };
  const updateMemory = async (id: string, updates: Partial<Omit<Memory, 'id'>>) => {
    if (!hasCloudSession) {
      throw new Error('请先登录后再编辑回忆');
    }

    const response = await apiPatch<{ memory: Memory }>(`/memories/${id}`, updates);
    setMemories((prev) => {
      const next = prev.map((m) => (m.id === id ? response.memory : m));
      setYearStats(computeYearStatsFromMemories(next));
      return next;
    });
  };
  const deleteMemory = async (id: string) => {
    if (!hasCloudSession) {
      throw new Error('请先登录后再删除回忆');
    }

    await apiDelete(`/memories/${id}`);
    setMemories((prev) => {
      const next = prev.filter((m) => m.id !== id);
      setYearStats(computeYearStatsFromMemories(next));
      return next;
    });
  };
  const addEvent = async (newEvent: Omit<AnniversaryEvent, 'id'>) => {
    if (!hasCloudSession) {
      throw new Error('请先登录后再添加纪念日');
    }

    const response = await apiPost<{ event: AnniversaryEvent }>('/events', newEvent);
    setEvents((prev) =>
      dedupeRecentDuplicateEvents([response.event, ...prev.filter((item) => item.id !== response.event.id)])
    );
  };
  const updateEvent = async (id: string, updates: Partial<Omit<AnniversaryEvent, 'id'>>) => {
    if (!hasCloudSession) {
      throw new Error('请先登录后再编辑纪念日');
    }

    const response = await apiPatch<{ event: AnniversaryEvent }>(`/events/${id}`, updates);
    setEvents((prev) =>
      dedupeRecentDuplicateEvents(prev.map((e) => (e.id === id ? response.event : e)))
    );
  };
  const deleteEvent = async (id: string) => {
    if (!hasCloudSession) {
      throw new Error('请先登录后再删除纪念日');
    }

    await apiDelete(`/events/${id}`);
    setEvents((prev) => prev.filter((e) => e.id !== id));
  };
  const updateTogetherDate = async (date: string) => {
    if (!hasCloudSession) {
      throw new Error('请先登录后再更新纪念日');
    }

    const response = await apiPatch<{ settings: AppStateResponse['settings'] }>('/settings', {
      togetherDate: date,
    });
    setConnectionState((prev) => ({
      ...prev,
      togetherDate: response.settings.togetherDate || prev.togetherDate,
    }));
  };
  const connect = async (code: string): Promise<ConnectResult> => {
    const inviteCode = code.trim();
    if (inviteCode.length < 6) {
      return { ok: false, message: '邀请码格式不正确' };
    }

    if (!hasCloudSession) {
      return {
        ok: false,
        message: '请先登录账号后再绑定邀请码',
      };
    }

    try {
      const response = await apiPost<{
        ok?: boolean;
        pending?: boolean;
        message?: string;
        settings?: AppStateResponse['settings'];
      }>('/settings/connect', {
        inviteCode,
      });

      if (response.settings) {
        setConnectionState((prev) => ({
          ...prev,
          isConnected: Boolean(response.settings.isConnected),
          inviteCode: response.settings.inviteCode || prev.inviteCode,
          boundInviteCode: response.settings.boundInviteCode || prev.boundInviteCode,
          togetherDate: response.settings.togetherDate || prev.togetherDate,
        }));
      }

      return {
        ok: true,
        pending: Boolean(response.pending),
        message: response.message || '绑定请求已发送',
      };
    } catch (error: any) {
      console.error('connect failed:', error);
      return {
        ok: false,
        message: error?.message || '绑定失败，请重试',
      };
    }
  };

  const disconnect = async () => {
    if (!hasCloudSession) {
      throw new Error('请先登录后再解绑关系');
    }

    const response = await apiPost<{ settings: AppStateResponse['settings'] }>('/settings/disconnect');
    setConnectionState((prev) => ({
      ...prev,
      isConnected: Boolean(response.settings.isConnected),
      inviteCode: response.settings.inviteCode || prev.inviteCode,
      boundInviteCode: response.settings.boundInviteCode || null,
      togetherDate: response.settings.togetherDate || prev.togetherDate,
    }));
    triggerSessionSync();
  };
  const respondBindingRequest = async (
    requestId: string,
    action: 'accept' | 'reject'
  ): Promise<ConnectResult> => {
    if (!hasCloudSession) {
      return {
        ok: false,
        message: '请先登录后再处理请求',
      };
    }

    try {
      const response = await apiPost<{
        ok?: boolean;
        action?: 'accept' | 'reject';
        message?: string;
        settings?: AppStateResponse['settings'];
      }>(`/bindings/${requestId}/respond`, { action });

      if (response.settings) {
        setConnectionState((prev) => ({
          ...prev,
          isConnected: Boolean(response.settings.isConnected),
          inviteCode: response.settings.inviteCode || prev.inviteCode,
          boundInviteCode: response.settings.boundInviteCode || prev.boundInviteCode,
          togetherDate: response.settings.togetherDate || prev.togetherDate,
        }));
      }

      await refreshPendingBindingRequests();
      if (action === 'accept') {
        triggerSessionSync();
      }

      return {
        ok: true,
        message: response.message || (action === 'accept' ? 'Binding accepted' : 'Request rejected'),
      };
    } catch (error: any) {
      console.error('respondBindingRequest failed:', error);
      return {
        ok: false,
        message: error?.message || 'Failed to process request',
      };
    }
  };

  return (
    <AppContext.Provider
      value={{
        memories,
        yearStats,
        addMemory,
        addMemoriesBatch,
        updateMemory,
        deleteMemory,
        events,
        addEvent,
        updateEvent,
        deleteEvent,
        togetherDate: connectionState.togetherDate,
        updateTogetherDate,
        isConnected: connectionState.isConnected,
        inviteCode: connectionState.inviteCode,
        boundInviteCode: connectionState.boundInviteCode,
        connect,
        disconnect,
        pendingBindingRequests,
        refreshPendingBindingRequests,
        respondBindingRequest,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

export const calculateRelativeDays = (targetDate: string): number => {
  const today = getNow().startOf('day');
  const target = dayjs(targetDate).startOf('day');
  return target.diff(today, 'day');
};

export const calculateNextOccurrence = (targetDate: string): number => {
  const today = getNow().startOf('day');
  const target = dayjs(targetDate).startOf('day');

  const directDiff = target.diff(today, 'day');
  if (directDiff >= 0) return directDiff;

  const thisYear = target.year(today.year());
  const diffThisYear = thisYear.diff(today, 'day');
  if (diffThisYear >= 0) return diffThisYear;

  const nextYear = target.year(today.year() + 1);
  return nextYear.diff(today, 'day');
};

export const calculateDaysTogether = (startDate: string): number => {
  const start = dayjs(startDate).startOf('day');
  const today = getNow().startOf('day');
  return today.diff(start, 'day');
};

export const calculateDateDiff = (targetDate: string): number => {
  return calculateNextOccurrence(targetDate);
};



