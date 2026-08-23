// =============================================================================
// HistoryPanel — 저장한 문장 기록
// =============================================================================
// 번역한 문장을 저장해 두고 다시 읽거나 불러올 수 있습니다.
// 대화를 이어갈 때 자주 쓰는 문장을 다시 꺼내기 좋습니다.

import type { HistoryEntry } from '../types';
import { CloseIcon, RestoreIcon, SpeakerIcon } from './icons';

interface Props {
  entries: HistoryEntry[];
  onSpeak: (text: string) => void;
  onRestore: (text: string) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

/** epoch ms → "오후 3:24" 형태. */
function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('ko-KR', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function HistoryPanel({
  entries,
  onSpeak,
  onRestore,
  onDelete,
  onClearAll,
}: Props) {
  return (
    <section className="history" aria-label="대화 기록">
      <header className="history__header">
        <h2>대화 기록</h2>
        {entries.length > 0 && (
          <button
            type="button"
            className="history__clear"
            onClick={onClearAll}
            aria-label="기록 전체 삭제"
          >
            전체 삭제
          </button>
        )}
      </header>

      {entries.length === 0 ? (
        <p className="history__empty">
          저장한 문장이 없습니다. 번역 후 <strong>저장</strong> 버튼을 눌러보세요.
        </p>
      ) : (
        <ul className="history__list">
          {entries.map((entry) => (
            <li key={entry.id} className="history__item">
              <div className="history__content">
                <span className="history__text">{entry.text}</span>
                <time className="history__time">{formatTime(entry.createdAt)}</time>
              </div>
              <div className="history__actions">
                <button
                  type="button"
                  onClick={() => onSpeak(entry.text)}
                  aria-label={`"${entry.text}" 읽기`}
                  title="읽기"
                >
                  <SpeakerIcon size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => onRestore(entry.text)}
                  aria-label={`"${entry.text}" 편집창으로 불러오기`}
                  title="불러오기"
                >
                  <RestoreIcon size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(entry.id)}
                  aria-label={`"${entry.text}" 삭제`}
                  title="삭제"
                >
                  <CloseIcon size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
