import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowUpDown,
  Calendar as CalendarIcon,
  Edit2,
  Heart,
  Image as ImageIcon,
  Layers3,
  LayoutGrid,
  Loader,
  MoreVertical,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useApp, calculateDaysTogether, calculateNextOccurrence } from '../context';
import { useAuth } from '../authContext';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PublisherBadge } from '../components/PublisherBadge';
import { validateFiles, compressImage, fileToBase64, getPhotoMetadata } from '../utils/imageUpload';
import { getDateValidationError, getMinDate, getMaxDate } from '../utils/dateValidation';
import { useToast } from '../components/Toast';
import { Memory, YearStat } from '../types';

const stripExtension = (name: string) => name.replace(/\.[^/.]+$/, '');
type TimelineViewMode = 'masonry' | 'story';
type TimelineSortOrder = 'desc' | 'asc';
const TIMELINE_VIEW_STORAGE_KEY = 'gifts_timeline_view_mode';
const TIMELINE_SORT_STORAGE_KEY = 'gifts_timeline_sort_order';

const toDateInputValue = (value: string): string => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const ymdMatch = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) return '';
  return new Date(parsed).toISOString().slice(0, 10);
};

const parseTimelineDate = (value: string) => {
  const raw = String(value || '').trim();
  if (!raw) return 0;

  const dateOnlyMatch = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]) - 1;
    const day = Number(dateOnlyMatch[3]);
    return new Date(year, month, day).getTime();
  }

  const direct = Date.parse(raw);
  if (!Number.isNaN(direct)) return direct;

  const normalized = toDateInputValue(raw);
  if (normalized) {
    const parts = normalized.split('-').map(Number);
    if (parts.length === 3) {
      return new Date(parts[0], parts[1] - 1, parts[2]).getTime();
    }
  }
  return 0;
};

const formatDisplayDate = (value: string) => {
  const parsed = parseTimelineDate(value);
  if (!parsed) return value;
  return new Date(parsed).toLocaleDateString('zh-CN');
};

const formatDisplayMonthDay = (value: string) => {
  const parsed = parseTimelineDate(value);
  if (!parsed) return '--.--';
  const d = new Date(parsed);
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
};

const runWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> => {
  const results: R[] = [];
  let index = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      // eslint-disable-next-line no-await-in-loop
      results[current] = await worker(items[current], current);
    }
  });

  await Promise.all(runners);
  return results;
};

const buildYearStatsFallback = (items: Memory[]): YearStat[] => {
  const groups: Record<string, { year: string; count: number; coverMemoryId: string; coverDate: number }> = {};

  for (const memory of items) {
    const year = toDateInputValue(memory.date)?.slice(0, 4) || '';
    if (!/^\d{4}$/.test(year)) continue;

    const memoryDate = parseTimelineDate(memory.date);
    if (!groups[year]) {
      groups[year] = {
        year,
        count: 1,
        coverMemoryId: memory.id,
        coverDate: memoryDate,
      };
      continue;
    }

    groups[year].count += 1;
    if (memoryDate > groups[year].coverDate) {
      groups[year].coverDate = memoryDate;
      groups[year].coverMemoryId = memory.id;
    }
  }

  return Object.values(groups)
    .sort((a, b) => b.year.localeCompare(a.year))
    .map(({ year, count, coverMemoryId }) => ({ year, count, coverMemoryId }));
};

export const TimelinePage: React.FC = () => {
  const {
    memories,
    yearStats,
    events,
    addMemory,
    addMemoriesBatch,
    updateMemory,
    deleteMemory,
    togetherDate,
  } = useApp();
  const { currentUser, partner } = useAuth();
  const { showToast } = useToast();

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [editingMemory, setEditingMemory] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [detectedDateTime, setDetectedDateTime] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingMemory, setIsSavingMemory] = useState(false);
  const [isBatchUploading, setIsBatchUploading] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [pendingDeleteMemoryId, setPendingDeleteMemoryId] = useState<string | null>(null);
  const [deletingMemoryId, setDeletingMemoryId] = useState<string | null>(null);
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [batchPreviewUrls, setBatchPreviewUrls] = useState<string[]>([]);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [uploadError, setUploadError] = useState('');
  const [dateError, setDateError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<TimelineViewMode>(() => {
    try {
      const mode = localStorage.getItem(TIMELINE_VIEW_STORAGE_KEY);
      if (mode === 'story' || mode === 'masonry') return mode;
    } catch (error) {
      console.error('Failed to read timeline view mode:', error);
    }
    return 'masonry';
  });
  const [sortOrder, setSortOrder] = useState<TimelineSortOrder>(() => {
    try {
      const mode = localStorage.getItem(TIMELINE_SORT_STORAGE_KEY);
      if (mode === 'asc' || mode === 'desc') return mode;
    } catch (error) {
      console.error('Failed to read timeline sort order:', error);
    }
    return 'desc';
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);
  const submitLockRef = useRef(false);
  const batchSubmitLockRef = useRef(false);
  const uploadTaskRef = useRef(0);
  const recentSubmitRef = useRef<{ signature: string; at: number }>({ signature: '', at: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const storyYearRefs = useRef<Record<string, HTMLElement | null>>({});
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeStoryYear, setActiveStoryYear] = useState<string | null>(null);
  const [collapsedStoryYears, setCollapsedStoryYears] = useState<Record<string, boolean>>({});
  const daysTogether = calculateDaysTogether(togetherDate);

  const resolvePublisher = (item: { userId?: string; author?: any }) => {
    const isPartner = Boolean(partner?.id && item.userId && item.userId === partner.id);
    const isOwn = !item.userId || item.userId === currentUser?.id;
    const fallbackUser = isPartner ? partner : currentUser;
    const fallbackName = fallbackUser?.name || fallbackUser?.email?.split('@')[0] || (isPartner ? '\u5bf9\u65b9' : '\u6211');
    return {
      isOwn,
      tag: isPartner ? 'Ta' : '\u6211',
      name: item.author?.name || fallbackName,
      avatar: item.author?.avatar || fallbackUser?.avatar || '',
      gender: item.author?.gender || fallbackUser?.gender || 'male',
    };
  };

  const canEditMemory = (memory: Memory) => resolvePublisher(memory).isOwn;

  useEffect(() => {
    return () => {
      batchPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [batchPreviewUrls]);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  useEffect(() => {
    try {
      localStorage.setItem(TIMELINE_VIEW_STORAGE_KEY, viewMode);
    } catch (error) {
      console.error('Failed to persist timeline view mode:', error);
    }
  }, [viewMode]);

  useEffect(() => {
    try {
      localStorage.setItem(TIMELINE_SORT_STORAGE_KEY, sortOrder);
    } catch (error) {
      console.error('Failed to persist timeline sort order:', error);
    }
  }, [sortOrder]);

  const sortedMemories = useMemo(
    () =>
      [...memories].sort((a, b) => {
        const aDate = parseTimelineDate(a.date);
        const bDate = parseTimelineDate(b.date);
        if (!aDate && !bDate) {
          return sortOrder === 'desc'
            ? String(b.id).localeCompare(String(a.id))
            : String(a.id).localeCompare(String(b.id));
        }
        if (!aDate) return 1;
        if (!bDate) return -1;

        const diff =
          sortOrder === 'desc'
            ? bDate - aDate
            : aDate - bDate;
        if (diff !== 0) return diff;
        return sortOrder === 'desc'
          ? String(b.id).localeCompare(String(a.id))
          : String(a.id).localeCompare(String(b.id));
      }),
    [memories, sortOrder]
  );
  const storyYearGroups = useMemo(
    () => {
      const groups: Array<{
        year: string;
        yearShort: string;
        items: Array<{ memory: Memory; index: number; monthDay: string }>;
      }> = [];

      for (let index = 0; index < sortedMemories.length; index += 1) {
        const memory = sortedMemories[index];
        const year = toDateInputValue(memory.date)?.slice(0, 4) || '----';
        const monthDay = formatDisplayMonthDay(memory.date);
        const lastGroup = groups[groups.length - 1];

        if (!lastGroup || lastGroup.year !== year) {
          groups.push({
            year,
            yearShort: year !== '----' ? year.slice(2) : '--',
            items: [{ memory, index, monthDay }],
          });
          continue;
        }

        lastGroup.items.push({ memory, index, monthDay });
      }

      return groups;
    },
    [sortedMemories]
  );
  const storyYearOrder = useMemo(
    () => storyYearGroups.map((group) => group.year),
    [storyYearGroups]
  );

  const effectiveYearStats = useMemo(
    () => (yearStats.length > 0 ? yearStats : buildYearStatsFallback(memories)),
    [yearStats, memories]
  );

  const memoryImageById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const memory of memories) {
      map[memory.id] = memory.image;
    }
    return map;
  }, [memories]);

  const yearMemoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const stat of effectiveYearStats) {
      counts[stat.year] = stat.count;
    }
    return counts;
  }, [effectiveYearStats]);

  const yearCoverImages = useMemo(() => {
    const covers: Record<string, string> = {};
    for (const stat of effectiveYearStats) {
      const coverImage = memoryImageById[stat.coverMemoryId];
      if (coverImage) {
        covers[stat.year] = coverImage;
      }
    }
    return covers;
  }, [effectiveYearStats, memoryImageById]);

  useEffect(() => {
    if (viewMode !== 'story') return;
    if (!storyYearOrder.length) {
      setActiveStoryYear(null);
      return;
    }
    setActiveStoryYear((prev) => (prev && storyYearOrder.includes(prev) ? prev : storyYearOrder[0]));
  }, [viewMode, storyYearOrder]);

  useEffect(() => {
    if (!storyYearOrder.length) {
      setCollapsedStoryYears({});
      return;
    }
    setCollapsedStoryYears((prev) => {
      const next: Record<string, boolean> = {};
      for (const year of storyYearOrder) {
        next[year] = Boolean(prev[year]);
      }
      return next;
    });
  }, [storyYearOrder]);

  useEffect(() => {
    if (viewMode !== 'story') return;
    const scroller = timelineScrollRef.current;
    if (!scroller || !storyYearOrder.length) return;

    const updateActiveYear = () => {
      const rootTop = scroller.getBoundingClientRect().top + 96;
      let candidate = storyYearOrder[0];
      for (const year of storyYearOrder) {
        const node = storyYearRefs.current[year];
        if (!node) continue;
        if (node.getBoundingClientRect().top <= rootTop) {
          candidate = year;
        } else {
          break;
        }
      }
      setActiveStoryYear((prev) => (prev === candidate ? prev : candidate));
    };

    updateActiveYear();
    scroller.addEventListener('scroll', updateActiveYear, { passive: true });
    window.addEventListener('resize', updateActiveYear);
    return () => {
      scroller.removeEventListener('scroll', updateActiveYear);
      window.removeEventListener('resize', updateActiveYear);
    };
  }, [viewMode, storyYearOrder]);

  const scrollToStoryYear = (year: string) => {
    const scroller = timelineScrollRef.current;
    const target = storyYearRefs.current[year];
    if (!scroller || !target) return;
    const rootRect = scroller.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const top = targetRect.top - rootRect.top + scroller.scrollTop - 72;
    scroller.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    setActiveStoryYear(year);
  };

  const toggleStoryYearCollapsed = (year: string) => {
    setCollapsedStoryYears((prev) => ({
      ...prev,
      [year]: !prev[year],
    }));
  };
  const milestoneEvents = useMemo(
    () =>
      [...events]
        .sort((a, b) => {
          const nextA = calculateNextOccurrence(a.date);
          const nextB = calculateNextOccurrence(b.date);
          if (nextA !== nextB) return nextA - nextB;
          return String(a.date || '').localeCompare(String(b.date || ''));
        })
        .slice(0, 6),
    [events]
  );

  const resetForm = () => {
    uploadTaskRef.current += 1;
    submitLockRef.current = false;
    recentSubmitRef.current = { signature: '', at: 0 };
    setTitle('');
    setDate('');
    setDetectedDateTime(null);
    setImageUrl('');
    setUploadError('');
    setDateError(null);
    setEditingMemory(null);
  };

  const resetBatchSelection = () => {
    batchSubmitLockRef.current = false;
    setBatchFiles([]);
    setBatchPreviewUrls([]);
    setBatchProgress({ current: 0, total: 0 });
  };

  const handleDateChange = (value: string) => {
    setDate(value);
    setDetectedDateTime(null);
    setDateError(getDateValidationError(value));
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const uploadTaskId = uploadTaskRef.current + 1;
    uploadTaskRef.current = uploadTaskId;

    setUploadError('');
    setImageUrl('');
    setDetectedDateTime(null);
    setIsUploading(true);

    try {
      const validation = validateFiles([file], 1, 5);
      if (!validation.valid) {
        setUploadError(validation.errors.join(', '));
        return;
      }

      const metadata = await getPhotoMetadata(file);
      const compressed = await compressImage(file, 2.2, 1440);
      const base64 = await fileToBase64(compressed);
      if (uploadTaskRef.current !== uploadTaskId) return;

      setImageUrl(base64);
      if (!date) {
        const nextDate = toDateInputValue(metadata.date);
        setDate(nextDate);
        setDateError(getDateValidationError(nextDate));
      }
      setDetectedDateTime(metadata.dateTime);
      if (!title) setTitle(stripExtension(file.name) || '\u65b0\u7684\u56de\u5fc6');
    } catch (error) {
      if (uploadTaskRef.current !== uploadTaskId) return;
      console.error('Image upload failed:', error);
      setUploadError('\u56fe\u7247\u5904\u7406\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5');
    } finally {
      if (uploadTaskRef.current === uploadTaskId) {
        setIsUploading(false);
      }
      if (e.target) e.target.value = '';
    }
  };

  const handleBatchSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadError('');

    try {
      const validation = validateFiles(files, 30, 8);
      if (!validation.valid) {
        showToast(validation.errors.join(', '), 'error');
        return;
      }

      const previewUrls = files.map((file) => URL.createObjectURL(file));
      setBatchFiles(files);
      setBatchPreviewUrls(previewUrls);
      setBatchProgress({ current: 0, total: files.length });
      setIsBatchModalOpen(true);
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleBatchUpload = async () => {
    if (batchSubmitLockRef.current || isBatchUploading) return;
    if (batchFiles.length === 0) {
      showToast('\u8bf7\u5148\u9009\u62e9\u9700\u8981\u4e0a\u4f20\u7684\u56fe\u7247', 'error');
      return;
    }

    batchSubmitLockRef.current = true;
    setIsBatchUploading(true);
    setBatchProgress({ current: 0, total: batchFiles.length });

    try {
      const preparedResults = await runWithConcurrency(batchFiles, 3, async (file, index) => {
        try {
          const [metadata, compressed] = await Promise.all([getPhotoMetadata(file), compressImage(file, 1.3, 1280)]);
          const base64 = await fileToBase64(compressed);
          return {
            ok: true as const,
            payload: {
              title: stripExtension(file.name) || `\u56de\u5fc6 ${index + 1}`,
              date: toDateInputValue(metadata.date) || new Date().toISOString().slice(0, 10),
              image: base64,
            },
          };
        } catch (error: any) {
          return {
            ok: false as const,
            fileName: file.name,
            message: error?.message || '\u5904\u7406\u5931\u8d25',
          };
        } finally {
          setBatchProgress((prev) => ({ ...prev, current: prev.current + 1 }));
        }
      });

      const prepared = preparedResults
        .filter((item): item is { ok: true; payload: { title: string; date: string; image: string } } => item.ok)
        .map((item) => item.payload);
      const failedPrepared = preparedResults.filter((item) => !item.ok);

      if (prepared.length === 0) {
        showToast('\u6ca1\u6709\u53ef\u4e0a\u4f20\u7684\u56fe\u7247\uff0c\u8bf7\u66f4\u6362\u56fe\u7247\u540e\u91cd\u8bd5', 'error');
        return;
      }

      if (failedPrepared.length > 0) {
        showToast(`\u6709 ${failedPrepared.length} \u5f20\u56fe\u7247\u5904\u7406\u5931\u8d25\uff0c\u5df2\u81ea\u52a8\u8df3\u8fc7`, 'error');
      }

      const inserted = await addMemoriesBatch(prepared);
      showToast(`\u6279\u91cf\u4e0a\u4f20\u5b8c\u6210\uff1a\u6210\u529f ${inserted} \u5f20`, 'success');
      setIsBatchModalOpen(false);
      resetBatchSelection();
    } catch (error: any) {
      console.error('Batch upload failed:', error);
      showToast(error?.message || '\u6279\u91cf\u4e0a\u4f20\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5', 'error');
    } finally {
      batchSubmitLockRef.current = false;
      setIsBatchUploading(false);
      setBatchProgress((prev) => (prev.total > 0 ? { current: prev.current, total: prev.total } : { current: 0, total: 0 }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitLockRef.current || isSavingMemory) return;
    submitLockRef.current = true;
    setIsSavingMemory(true);
    setDateError(null);

    try {
      const normalizedDate = toDateInputValue(date);
      const nextDateError = getDateValidationError(normalizedDate);
      if (nextDateError) {
        setDateError(nextDateError);
        return;
      }

      if (!title || !normalizedDate || !imageUrl) {
        showToast('\u8bf7\u5148\u8865\u5168\u6807\u9898\u3001\u65e5\u671f\u548c\u56fe\u7247', 'error');
        return;
      }

      const normalizedTitle = title.trim();
      const submitSignature = `${editingMemory || 'new'}|${normalizedTitle}|${normalizedDate}|${imageUrl.length}|${imageUrl.slice(0, 128)}`;
      const nowMs = Date.now();
      if (
        recentSubmitRef.current.signature === submitSignature &&
        nowMs - recentSubmitRef.current.at < 6000
      ) {
        return;
      }
      recentSubmitRef.current = { signature: submitSignature, at: nowMs };

      if (editingMemory) {
        await updateMemory(editingMemory, { title: normalizedTitle, date: normalizedDate, image: imageUrl });
        showToast('\u5df2\u66f4\u65b0\u56de\u5fc6', 'success');
      } else {
        await addMemory({ title: normalizedTitle, date: normalizedDate, image: imageUrl });
        showToast('\u5df2\u6dfb\u52a0\u56de\u5fc6', 'success');
      }

      setIsUploadOpen(false);
      resetForm();
    } catch (error: any) {
      recentSubmitRef.current = { signature: '', at: 0 };
      console.error('save memory failed:', error);
      showToast(error?.message || '\u4fdd\u5b58\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5', 'error');
    } finally {
      submitLockRef.current = false;
      setIsSavingMemory(false);
    }
  };
  const startEdit = (memoryId: string) => {
    const memory = memories.find((m) => m.id === memoryId);
    if (!memory) return;

    setTitle(memory.title);
    setDate(toDateInputValue(memory.date));
    setDetectedDateTime(memory.date.includes('T') ? memory.date : null);
    setImageUrl(memory.image);
    setEditingMemory(memoryId);
    setIsUploadOpen(true);
  };

  const handleDelete = (memoryId: string) => {
    setPendingDeleteMemoryId(memoryId);
  };

  const confirmDeleteMemory = async () => {
    if (!pendingDeleteMemoryId) return;
    const memoryId = pendingDeleteMemoryId;
    setDeletingMemoryId(memoryId);
    try {
      await deleteMemory(memoryId);
      showToast('\u5df2\u5220\u9664\u56de\u5fc6', 'success');
    } catch (error: any) {
      console.error('delete memory failed:', error);
      showToast(error?.message || '\u5220\u9664\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5', 'error');
    } finally {
      setDeletingMemoryId(null);
      setPendingDeleteMemoryId(null);
    }
  };
  const toggleViewMode = () => {
    setViewMode((prev) => (prev === 'masonry' ? 'story' : 'masonry'));
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
  };

  return (
    <div className="flex flex-col h-full bg-[var(--eye-bg-primary)]">
      <header className="relative w-full pt-safe-top z-40 shrink-0">
        <div className="absolute inset-0 bg-[var(--eye-bg-primary)]/80 backdrop-blur-2xl border-b border-[var(--eye-border)] shadow-sm" />
        <div className="relative flex items-center justify-between pt-4 pb-3 px-4">
          <div className="flex items-center gap-2 text-sage text-xs font-semibold bg-primary/5 rounded-full px-3 py-1">
            <Heart className="w-3 h-3 fill-current text-rose-400" />
            <span>{'\u5728\u4e00\u8d77'} {daysTogether} {'\u5929'}</span>
          </div>

          <h1 className="text-text-main dark:text-white text-lg font-bold">{'\u65f6\u5149\u76f8\u518c'}</h1>

          <div className="flex items-center gap-2">
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setIsMenuOpen((v) => !v)}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all"
                title={'\u66f4\u591a\u9009\u9879'}
              >
                <MoreVertical className="w-5 h-5" />
              </button>

              {isMenuOpen && (
                <div className="absolute right-0 top-12 w-48 rounded-2xl bg-white dark:bg-[#2b2f2a] border border-[var(--eye-border)] shadow-xl z-50 py-1 animate-scale-up origin-top-right">
                  <button
                    onClick={() => { toggleSortOrder(); setIsMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[var(--eye-text-primary)] hover:bg-primary/10 transition-colors"
                  >
                    <ArrowUpDown className="w-4 h-4 text-primary" />
                    <span>{'\u6392\u5e8f\uff1a'}{sortOrder === 'desc' ? '\u65b0\u5230\u65e7' : '\u65e7\u5230\u65b0'}</span>
                  </button>
                  <button
                    onClick={() => { toggleViewMode(); setIsMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[var(--eye-text-primary)] hover:bg-primary/10 transition-colors"
                  >
                    {viewMode === 'masonry' ? <CalendarIcon className="w-4 h-4 text-primary" /> : <LayoutGrid className="w-4 h-4 text-primary" />}
                    <span>{'\u89c6\u56fe\uff1a'}{viewMode === 'masonry' ? '\u5207\u6362\u65f6\u95f4\u7ebf' : '\u5207\u6362\u7011\u5e03\u6d41'}</span>
                  </button>
                  <input ref={batchInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleBatchSelect} />
                  <button
                    onClick={() => { batchInputRef.current?.click(); setIsMenuOpen(false); }}
                    disabled={isBatchUploading}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[var(--eye-text-primary)] hover:bg-primary/10 transition-colors disabled:opacity-60"
                  >
                    {isBatchUploading ? <Loader className="w-4 h-4 animate-spin text-primary" /> : <Layers3 className="w-4 h-4 text-primary" />}
                    <span>{isBatchUploading ? '\u4e0a\u4f20\u4e2d...' : '\u6279\u91cf\u4e0a\u4f20'}</span>
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={() => {
                resetForm();
                setIsUploadOpen(true);
              }}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all"
              title={'\u6dfb\u52a0\u56de\u5fc6'}
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>
        </div>
      </header>

      {isBatchUploading && batchProgress.total > 0 && (
        <div className="relative z-40 px-4 py-2 bg-[var(--eye-bg-primary)]/90 backdrop-blur-sm border-b border-[var(--eye-border)] shrink-0">
          <div className="flex items-center justify-between text-xs text-sage mb-1">
            <span className="font-semibold">{'\u5904\u7406\u4e2d...'}</span>
            <span className="tabular-nums font-bold text-primary">{batchProgress.current}/{batchProgress.total}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-sage-light/30 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-all duration-300 ease-out"
              style={{ width: `${Math.round((batchProgress.current / batchProgress.total) * 100)}%` }}
            />
          </div>
        </div>
      )}

      <div
        ref={timelineScrollRef}
        className="timeline-scroll-surface flex-1 overflow-y-auto px-4 pb-28 pt-4 hide-scrollbar scrapbook-paper-board"
      >
        {viewMode === 'story' && storyYearOrder.length > 1 && (
          <div className="story-year-quicknav animate-fade-in-up">
            {storyYearOrder.map((year) => {
              const isActive = activeStoryYear === year;
              const isCollapsed = Boolean(collapsedStoryYears[year]);
              return (
                <button
                  key={year}
                  type="button"
                  onClick={() => (isActive ? toggleStoryYearCollapsed(year) : scrollToStoryYear(year))}
                  className={`story-year-chip ${isActive ? 'is-active' : ''} ${isCollapsed ? 'is-collapsed' : ''}`}
                  aria-label={`\u8df3\u8f6c\u5230 ${year} \u5e74`}
                >
                  <span className="story-year-chip-label">{year}</span>
                  <span className="story-year-chip-count">{yearMemoryCounts[year] || 0}</span>
                </button>
              );
            })}
          </div>
        )}

        {viewMode === 'masonry' && milestoneEvents.length > 0 && (
          <section className="scrapbook-milestone-card mb-5 animate-fade-in-up">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-[var(--eye-text-primary)]">{'\u7eaa\u5ff5\u65e5\u8282\u70b9'}</h3>
            </div>
            <div className="scrapbook-milestone-list">
              {milestoneEvents.map((event) => (
                <div key={event.id} className="scrapbook-milestone-item">
                  <div className="scrapbook-milestone-dot" />
                  <div className="scrapbook-milestone-content">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-semibold text-[var(--eye-text-primary)] truncate">
                        {event.title}
                      </p>
                      {(() => {
                        const publisher = resolvePublisher(event as any);
                        return (
                          <PublisherBadge
                            tag={publisher.tag}
                            name={publisher.name}
                            avatar={publisher.avatar}
                            gender={publisher.gender}
                            isOwn={publisher.isOwn}
                          />
                        );
                      })()}
                    </div>
                    <p className="text-[11px] text-[var(--eye-text-secondary)] mt-0.5">
                      {event.date} {'\u00b7'} {event.type}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {sortedMemories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 animate-fade-in text-center">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/10 to-sage/10 flex items-center justify-center mb-5">
              <Heart className="w-10 h-10 text-primary/40" />
            </div>
            <h3 className="text-text-main dark:text-white text-xl font-bold mb-2">{'\u8fd8\u6ca1\u6709\u56de\u5fc6'}</h3>
            <p className="text-sage text-sm mb-6">{'\u70b9\u51fb\u53f3\u4e0a\u89d2\u6309\u94ae\uff0c\u6dfb\u52a0\u7b2c\u4e00\u5f20\u7167\u7247\u56de\u5fc6'}</p>
            <button
              onClick={() => {
                resetForm();
                setIsUploadOpen(true);
              }}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-primary/10 text-primary font-semibold text-sm hover:bg-primary hover:text-white transition-all"
            >
              <Plus className="w-4 h-4" />
              {'\u6dfb\u52a0\u7b2c\u4e00\u5f20'}
            </button>
          </div>
        ) : viewMode === 'masonry' ? (
          <div key="masonry" className="memory-masonry view-switch-enter">
            {sortedMemories.map((memory, index) => (
              <article
                key={memory.id}
                className={`memory-masonry-item scrapbook-polaroid polaroid-lift group transition-transform duration-300 animate-fade-in-up ${memory.rotation || ''} hover:rotate-0 hover:-translate-y-1`}
                style={{ animationDelay: `${Math.min(index * 35, 260)}ms` }}
              >
                <div className="scrapbook-pin" />
                <button className="w-full block overflow-hidden rounded-[4px]" onClick={() => setSelectedImage(memory.image)}>
                  <img
                    src={memory.image}
                    alt={memory.title}
                    className="w-full h-auto object-contain rounded-[4px] border border-stone-200/70 bg-[var(--eye-bg-secondary)] transition-transform duration-500 group-hover:scale-[1.02]"
                    loading="lazy"
                  />
                </button>

                <div className="mt-3 px-0.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-text-main dark:text-white font-bold text-sm leading-snug">{memory.title}</p>
                    {(() => {
                      const publisher = resolvePublisher(memory);
                      return (
                        <PublisherBadge
                          tag={publisher.tag}
                          name={publisher.name}
                          avatar={publisher.avatar}
                          gender={publisher.gender}
                          isOwn={publisher.isOwn}
                        />
                      );
                    })()}
                  </div>
                  <p className="font-handwriting text-base text-sage mt-1 tracking-wide">
                    {formatDisplayDate(memory.date)}
                  </p>
                </div>

                {canEditMemory(memory) && (
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      onClick={() => startEdit(memory.id)}
                      className="p-2 bg-primary/10 text-primary rounded-full hover:bg-primary hover:text-white transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(memory.id)}
                      disabled={Boolean(deletingMemoryId)}
                      className="p-2 bg-red-100 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div key="story" className="story-timeline view-switch-enter">
            <div className="story-year-rail" aria-hidden />
            {storyYearGroups.map((group, groupIndex) => {
              const isActive = activeStoryYear === group.year;
              const isCollapsed = Boolean(collapsedStoryYears[group.year]);
              const memoryCount = yearMemoryCounts[group.year] || group.items.length;

              return (
                <section
                  key={group.year}
                  ref={(node) => { storyYearRefs.current[group.year] = node; }}
                  className={`story-year-group animate-fade-in-up ${isActive ? 'is-active' : ''} ${isCollapsed ? 'is-collapsed' : ''}`}
                  style={{ animationDelay: `${Math.min(groupIndex * 65, 360)}ms` }}
                >
                  <div className="story-year-group-col">
                    <button
                      type="button"
                      onClick={() => toggleStoryYearCollapsed(group.year)}
                      className="story-year-anchor-button story-year-anchor story-year-anchor-sticky"
                      aria-expanded={!isCollapsed}
                      aria-controls={`story-year-panel-${group.year}`}
                      aria-label={`\u5c55\u5f00\u6216\u6536\u8d77 ${group.year} \u5e74`}
                    >
                      <div className={`story-year-badge ${isActive ? 'story-year-badge-active' : ''} ${isCollapsed ? 'story-year-badge-collapsed' : ''}`}>
                        {yearCoverImages[group.year] && (
                          <div
                            className="story-year-badge-cover"
                            style={{ backgroundImage: `url('${yearCoverImages[group.year]}')` }}
                          />
                        )}
                        <span className="story-year-main">{group.yearShort}</span>
                        <span className="story-year-sub">{group.year}</span>
                        <span className="story-year-count">{memoryCount}</span>
                        <span className="story-year-collapse-indicator" aria-hidden>
                          {isCollapsed ? '+' : '-'}
                        </span>
                      </div>
                    </button>
                  </div>

                  <div
                    id={`story-year-panel-${group.year}`}
                    className={`story-year-group-content ${isCollapsed ? 'is-collapsed' : ''}`}
                  >
                    {isCollapsed ? (
                      <button
                        type="button"
                        onClick={() => toggleStoryYearCollapsed(group.year)}
                        className="story-year-collapsed-summary"
                      >
                        {memoryCount} {'\u6761\u56de\u5fc6'}
                      </button>
                    ) : (
                      group.items.map((entry) => (
                        <article
                          key={entry.memory.id}
                          className="story-memory-row animate-fade-in-up"
                          style={{ animationDelay: `${Math.min(entry.index * 40, 340)}ms` }}
                        >
                          <div className="story-memory-marker">
                            <div className={`story-year-dot ${isActive ? 'story-year-dot-active' : ''}`} />
                          </div>

                          <div className={`story-card group ${entry.memory.rotation || ''} hover:rotate-0`}>
                            <button className="story-photo-wrap" onClick={() => setSelectedImage(entry.memory.image)}>
                              <img
                                src={entry.memory.image}
                                alt={entry.memory.title}
                                className="story-photo transition-transform duration-500 group-hover:scale-[1.015]"
                                loading="lazy"
                              />
                            </button>

                            <div className="story-card-body">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-text-main dark:text-white font-bold text-[15px] leading-snug">
                                  {entry.memory.title}
                                </p>
                                {(() => {
                                  const publisher = resolvePublisher(entry.memory);
                                  return (
                                    <PublisherBadge
                                      tag={publisher.tag}
                                      name={publisher.name}
                                      avatar={publisher.avatar}
                                      gender={publisher.gender}
                                      isOwn={publisher.isOwn}
                                    />
                                  );
                                })()}
                              </div>
                              <p className="font-handwriting text-[18px] text-sage mt-1 tracking-wide">{entry.monthDay}</p>
                              <p className="text-[11px] text-[var(--eye-text-secondary)] mt-1">
                                {formatDisplayDate(entry.memory.date)}
                              </p>
                            </div>

                            {canEditMemory(entry.memory) && (
                              <div className="mt-3 flex justify-end gap-2">
                                <button
                                  onClick={() => startEdit(entry.memory.id)}
                                  className="p-2 bg-primary/10 text-primary rounded-full hover:bg-primary hover:text-white transition-all"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(entry.memory.id)}
                                  disabled={Boolean(deletingMemoryId)}
                                  className="p-2 bg-red-100 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-all"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        isOpen={isUploadOpen}
        onClose={() => {
          setIsUploadOpen(false);
          resetForm();
        }}
        title={editingMemory ? '\u7f16\u8f91\u56de\u5fc6' : '\u6dfb\u52a0\u56de\u5fc6'}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-sage mb-1">{'\u7167\u7247'}</label>
            {imageUrl ? (
              <div className="relative rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800">
                <img src={imageUrl} alt="preview" className="w-full h-56 object-contain bg-[var(--eye-bg-secondary)]" />
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full h-32 rounded-xl border-2 border-dashed border-sage/30 bg-gray-50 dark:bg-white/5 flex flex-col items-center justify-center gap-2 text-sage hover:border-primary hover:text-primary transition-all disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <Loader className="w-8 h-8 animate-spin" />
                      <span className="text-sm">{'\u5904\u7406\u4e2d...'}</span>
                    </>
                  ) : (
                    <>
                      <ImageIcon className="w-8 h-8" />
                      <span className="text-sm font-medium">{'\u70b9\u51fb\u9009\u62e9\u7167\u7247'}</span>
                    </>
                  )}
                </button>
              </div>
            )}
            {uploadError && <p className="text-red-500 text-sm mt-1">{uploadError}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-sage mb-1">{'\u6807\u9898'}</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={'\u4f8b\u5982\uff1a\u7b2c\u4e00\u6b21\u770b\u7535\u5f71'}
              className="w-full rounded-xl bg-gray-50 dark:bg-white/5 border-none p-3 text-text-main dark:text-white focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-sage mb-1">{'\u65e5\u671f'}</label>
            <div className="relative">
              <input
                type="date"
                required
                value={date}
                onChange={(e) => handleDateChange(e.target.value)}
                min={getMinDate()}
                max={getMaxDate()}
                className={`w-full rounded-xl bg-gray-50 dark:bg-white/5 border-none p-3 pl-10 text-text-main dark:text-white focus:ring-2 ${
                  dateError ? 'focus:ring-red-500/50 ring-2 ring-red-500/50' : 'focus:ring-primary/50'
                }`}
              />
              <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sage" />
            </div>
            {detectedDateTime && parseTimelineDate(detectedDateTime) > 0 && (
              <p className="text-[11px] text-sage mt-1">
                {'\u5df2\u81ea\u52a8\u8bc6\u522b\u62cd\u6444\u65f6\u95f4\uff1a'}{new Date(parseTimelineDate(detectedDateTime)).toLocaleString('zh-CN')}
              </p>
            )}
            {dateError && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {dateError}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={!imageUrl || isUploading || isSavingMemory}
            className="w-full mt-2 bg-primary hover:bg-[#7a8a4b] text-white font-bold h-12 rounded-xl shadow-lg shadow-primary/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSavingMemory ? '\u4fdd\u5b58\u4e2d...' : editingMemory ? '\u4fdd\u5b58\u4fee\u6539' : '\u4fdd\u5b58\u56de\u5fc6'}
          </button>
        </form>
      </Modal>

      <Modal
        isOpen={isBatchModalOpen}
        onClose={() => {
          if (isBatchUploading) return;
          setIsBatchModalOpen(false);
          resetBatchSelection();
        }}
        title={'\u6279\u91cf\u4e0a\u4f20\u56de\u5fc6'}
      >
        <div className="flex flex-col gap-4">
          {batchPreviewUrls.length > 0 && (
            <div className="grid grid-cols-3 gap-2 max-h-72 overflow-y-auto hide-scrollbar pr-1">
              {batchPreviewUrls.map((url, index) => (
                <div key={`${url}-${index}`} className="relative overflow-hidden rounded-xl bg-[var(--eye-bg-secondary)] border border-[var(--eye-border)]">
                  <img
                    src={url}
                    alt={`batch-${index + 1}`}
                    className="w-full h-24 object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="rounded-xl bg-primary/5 border border-primary/15 p-3 text-sm text-sage">
            <p className="font-semibold text-[var(--eye-text-primary)]">
              {'\u5df2\u9009\u62e9'} {batchFiles.length} {'\u5f20\u56fe\u7247'}
            </p>
            <p className="mt-1 text-xs">
              {'\u4fdd\u5b58\u540e\u4f1a\u81ea\u52a8\u538b\u7f29\u3001\u8bc6\u522b\u62cd\u6444\u65e5\u671f\u5e76\u6279\u91cf\u751f\u6210\u56de\u5fc6'}
            </p>
          </div>

          {isBatchUploading && batchProgress.total > 0 && (
            <div className="rounded-xl border border-[var(--eye-border)] p-3">
              <div className="flex items-center justify-between text-xs text-sage mb-1">
                <span className="font-semibold">{'\u6b63\u5728\u4e0a\u4f20...'}</span>
                <span className="tabular-nums font-bold text-primary">
                  {Math.min(batchProgress.current, batchProgress.total)}/{batchProgress.total}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-sage-light/30 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-all duration-300"
                  style={{
                    width: `${batchProgress.total > 0 ? Math.round((Math.min(batchProgress.current, batchProgress.total) / batchProgress.total) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setIsBatchModalOpen(false);
                resetBatchSelection();
              }}
              disabled={isBatchUploading}
              className="flex-1 h-11 rounded-xl border border-[var(--eye-border)] text-[var(--eye-text-primary)] bg-[var(--eye-bg-secondary)] hover:bg-black/5 transition-all disabled:opacity-60"
            >
              {'\u53d6\u6d88'}
            </button>
            <button
              type="button"
              onClick={handleBatchUpload}
              disabled={isBatchUploading || batchFiles.length === 0}
              className="flex-1 h-11 rounded-xl bg-primary hover:bg-[#7a8a4b] text-white font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isBatchUploading
                ? '\u4e0a\u4f20\u4e2d...'
                : `\u4fdd\u5b58 ${batchFiles.length} \u5f20\u56de\u5fc6`}
            </button>
          </div>
        </div>
      </Modal>

      {selectedImage && (
        <div
          className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm"
          onClick={() => setSelectedImage(null)}
        >
          <button className="absolute top-6 right-6 p-3 text-white/40 hover:text-white transition-colors rounded-full hover:bg-white/10">
            <X className="w-7 h-7" />
          </button>
          <div className="bg-white p-3 rounded-sm transform max-w-full max-h-full overflow-hidden animate-scale-up shadow-2xl">
            <img
              src={selectedImage}
              alt="Full view"
              className="max-w-full max-h-[80vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(pendingDeleteMemoryId)}
        title="确定要删除这条回忆吗？"
        description="删除后将无法恢复，请确认是否继续。"
        confirmText="确认删除"
        cancelText="先保留"
        confirmTone="danger"
        loading={Boolean(deletingMemoryId)}
        onCancel={() => setPendingDeleteMemoryId(null)}
        onConfirm={confirmDeleteMemory}
      />
    </div>
  );
};



