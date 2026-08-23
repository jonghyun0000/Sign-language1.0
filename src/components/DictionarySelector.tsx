// =============================================================================
// DictionarySelector — 인식 후보를 좁혀 정확도를 높이는 선택기
// =============================================================================
// 손 모양의 가짓수는 한정적이라 자음과 모음이 겹칩니다. 후보를 좁히면
// 오인식이 크게 줄어들기 때문에, 사용자가 직접 고를 수 있게 했습니다.
//
// 기본값인 "스마트"는 한글 구조를 이용해 자동으로 전환하므로 대부분의
// 경우 가장 편합니다.

import type { DictionaryMode } from '../types';

interface Props {
  value: DictionaryMode;
  onChange: (mode: DictionaryMode) => void;
  /** 스마트 모드일 때 지금 무엇을 기다리는지 표시합니다. */
  expecting: 'consonant' | 'vowel';
}

const OPTIONS: Array<{ id: DictionaryMode; label: string; desc: string }> = [
  { id: 'smart', label: '스마트', desc: '자음 → 모음 순서를 자동으로 전환 (권장)' },
  { id: 'consonant', label: '자음', desc: 'ㄱ ㄴ ㄷ … 만 인식' },
  { id: 'vowel', label: '모음', desc: 'ㅏ ㅓ ㅗ … 만 인식' },
  { id: 'word', label: '단어', desc: '안녕하세요 등 인사말만 인식' },
  { id: 'all', label: '전체', desc: '모두 인식 (자유롭지만 오인식이 많음)' },
];

export function DictionarySelector({ value, onChange, expecting }: Props) {
  return (
    <div className="dict-selector">
      <div className="dict-selector__head">
        <span className="dict-selector__title">인식 범위</span>
        {value === 'smart' && (
          <span className="dict-selector__badge">
            지금 기다리는 것: {expecting === 'consonant' ? '자음' : '모음'}
          </span>
        )}
      </div>
      <div className="dict-selector__options">
        {OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`chip ${value === opt.id ? 'chip--active' : ''}`}
            onClick={() => onChange(opt.id)}
            title={opt.desc}
            aria-pressed={value === opt.id}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
