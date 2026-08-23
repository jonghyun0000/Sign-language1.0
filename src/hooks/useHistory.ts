// =============================================================================
// useHistory — 번역 문장을 localStorage에 저장하는 훅
// =============================================================================
// 브라우저를 닫았다 열어도 기록이 남습니다. 서버가 필요 없고, 데이터가
// 사용자 기기 밖으로 나가지 않아 개인정보 측면에서도 안전합니다.

import { useCallback, useEffect, useState } from 'react';

import type { HistoryEntry } from '../types';

const STORAGE_KEY = 'ksl-history-v1';
/** 너무 많이 쌓이지 않도록 상한을 둡니다. */
const MAX_ENTRIES = 50;

/** localStorage에서 안전하게 읽어옵니다 (손상된 데이터 방어). */
function loadEntries(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // 형태가 맞는 항목만 남깁니다.
    return parsed.filter(
      (e): e is HistoryEntry =>
        typeof e === 'object' &&
        e !== null &&
        typeof (e as HistoryEntry).id === 'string' &&
        typeof (e as HistoryEntry).text === 'string' &&
        typeof (e as HistoryEntry).createdAt === 'number',
    );
  } catch {
    // JSON이 깨졌거나 브라우저가 저장소를 막은 경우(시크릿 모드 등)
    return [];
  }
}

export function useHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>(() => loadEntries());

  // 변경될 때마다 저장합니다.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // 저장소가 가득 찼거나 접근이 막혔어도 앱은 계속 동작해야 합니다.
    }
  }, [entries]);

  /** 문장을 저장합니다. 빈 문자열은 무시합니다. */
  const add = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setEntries((prev) => {
      const entry: HistoryEntry = {
        // crypto.randomUUID는 최신 브라우저에서 지원됩니다.
        // 없을 경우를 대비해 대체 ID를 만듭니다.
        id:
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        text: trimmed,
        createdAt: Date.now(),
      };
      return [entry, ...prev].slice(0, MAX_ENTRIES);
    });
  }, []);

  const remove = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const clear = useCallback(() => setEntries([]), []);

  return { entries, add, remove, clear };
}
