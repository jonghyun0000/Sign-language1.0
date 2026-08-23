// =============================================================================
// useLearningProgress — 배운 것을 기억하는 훅
// =============================================================================
// 브라우저를 닫았다 열어도 진도가 남습니다. 서버가 없어도 되고, 학습 기록이
// 기기 밖으로 나가지 않습니다.

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'ksl-learning-progress-v1';

interface Progress {
  /** 완료한 레슨 id 목록. */
  completedLessons: string[];
  /** 통과한 개별 글자 목록 (레슨 중간에 그만둬도 남습니다). */
  masteredTargets: string[];
}

const EMPTY: Progress = { completedLessons: [], masteredTargets: [] };

function load(): Progress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return EMPTY;
    const p = parsed as Partial<Progress>;
    return {
      completedLessons: Array.isArray(p.completedLessons)
        ? p.completedLessons.filter((x): x is string => typeof x === 'string')
        : [],
      masteredTargets: Array.isArray(p.masteredTargets)
        ? p.masteredTargets.filter((x): x is string => typeof x === 'string')
        : [],
    };
  } catch {
    // 저장소가 막혀 있어도(시크릿 모드 등) 앱은 그냥 동작해야 합니다.
    return EMPTY;
  }
}

export function useLearningProgress() {
  const [progress, setProgress] = useState<Progress>(() => load());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
      // 저장 실패는 무시합니다.
    }
  }, [progress]);

  /** 글자 하나를 통과 처리합니다. */
  const markTarget = useCallback((label: string) => {
    setProgress((prev) =>
      prev.masteredTargets.includes(label)
        ? prev
        : { ...prev, masteredTargets: [...prev.masteredTargets, label] },
    );
  }, []);

  /** 레슨 하나를 완료 처리합니다. */
  const markLesson = useCallback((id: string) => {
    setProgress((prev) =>
      prev.completedLessons.includes(id)
        ? prev
        : { ...prev, completedLessons: [...prev.completedLessons, id] },
    );
  }, []);

  const isLessonDone = useCallback(
    (id: string) => progress.completedLessons.includes(id),
    [progress.completedLessons],
  );

  const isTargetDone = useCallback(
    (label: string) => progress.masteredTargets.includes(label),
    [progress.masteredTargets],
  );

  const resetAll = useCallback(() => setProgress(EMPTY), []);

  return {
    progress,
    markTarget,
    markLesson,
    isLessonDone,
    isTargetDone,
    resetAll,
  };
}
