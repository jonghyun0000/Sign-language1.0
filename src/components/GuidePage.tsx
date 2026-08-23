// =============================================================================
// GuidePage — 수어 사전 (어떤 손 모양이 어떤 뜻인지 알려주는 페이지)
// =============================================================================
// 이 앱에서 인식하는 모든 손 모양을 한자리에 모아 보여줍니다.
//
//   * 카테고리별(자음 / 모음 / 단어 / 이펙트)로 나눠서 탐색
//   * 검색으로 원하는 글자 바로 찾기
//   * 손 모양 그림 + 만드는 방법 + 뜻을 함께 표시
//   * ★ 연습 모드: 카메라를 켜둔 채로 손을 만들면, 지금 인식되는 카드가
//     실시간으로 강조됩니다. 맞게 하고 있는지 바로 알 수 있습니다.

import { memo, useMemo, useState } from 'react';

import { GESTURE_RULES } from '../data/koreanGestures';
import {
  CONFIDENCE_LABEL,
  CONFIDENCE_NOTE,
  type Confidence,
} from '../data/handshapes';
import { getEffectCatalog } from '../effects/EffectManager';
import type { EffectGestureId, GestureCategory, GestureShape } from '../types';
import { HandShape } from './HandShape';
import { FullScreenIcon, SearchIcon } from './icons';

/** 사전에서 보여줄 항목 하나 — 수어와 이펙트를 같은 모양으로 다룹니다. */
interface GuideEntry {
  id: string;
  /** 크게 표시할 이름 (자모 또는 이펙트 이름). */
  label: string;
  /** 손 모양 그림 데이터. */
  shape: GestureShape;
  /** 손을 어떻게 만드는지. */
  hint: string;
  /** 무슨 뜻인지 / 언제 쓰는지. */
  meaning: string;
  /** 분류 탭. */
  group: GuideGroup;
  /** 화면 전체 이펙트 표시. */
  screenWide?: boolean;
  /** 이 손 모양을 얼마나 믿을 수 있는가. */
  confidence: Confidence;
  /** 자료 출처. */
  source: string;
  /** 왜 이렇게 정했는지. */
  rationale: string;
  /** 사용하는 수형 이름. */
  handshapeName?: string;
}

type GuideGroup = 'consonant' | 'vowel' | 'word' | 'effect';

const GROUP_LABEL: Record<GuideGroup, string> = {
  consonant: '자음',
  vowel: '모음',
  word: '단어',
  effect: '이펙트',
};

const GROUP_DESCRIPTION: Record<GuideGroup, string> = {
  consonant: '지화(수어 지문자)의 자음입니다. 모음과 합쳐 글자를 만듭니다.',
  vowel: '지화의 모음입니다. 손가락 개수와 방향으로 구분합니다.',
  word: '자주 쓰는 인사말입니다. 한 동작으로 단어 전체가 입력됩니다.',
  effect: '이펙트 모드에서 쓰는 손 모양입니다.',
};

/** 수어 규칙 + 이펙트 목록을 사전 항목으로 합칩니다. */
function buildEntries(): GuideEntry[] {
  const signs: GuideEntry[] = GESTURE_RULES.map((rule) => ({
    id: `sign-${rule.label}`,
    label: rule.label,
    shape: rule.shape,
    hint: rule.hint,
    meaning: rule.meaning,
    group: rule.category as Exclude<GestureCategory, 'none'>,
    confidence: rule.confidence,
    source: rule.source,
    rationale: rule.rationale,
    handshapeName: rule.handshapeName,
  }));

  const effects: GuideEntry[] = getEffectCatalog().map((effect) => ({
    id: `effect-${effect.id}`,
    label: effect.label,
    shape: effect.shape,
    hint: effect.hint,
    meaning: effect.screenWide
      ? '양손으로 만들면 화면 전체에 펼쳐지는 필살기입니다.'
      : '손 주변에서 일어나는 이펙트입니다.',
    group: 'effect',
    screenWide: effect.screenWide,
    // 이펙트는 수어가 아니라 이 앱이 정한 동작이므로 신뢰도 개념이 없습니다.
    confidence: 'invented',
    source: '이 앱의 자체 이펙트 (수어 아님)',
    rationale: '수어와 무관한 놀이용 동작입니다.',
  }));

  return [...signs, ...effects];
}

const ALL_ENTRIES = buildEntries();

interface Props {
  /**
   * 지금 카메라로 인식되고 있는 수어 라벨 (연습 모드 강조용).
   * 번역 모드의 분류기가 알려줍니다.
   */
  liveLabel: string | null;
  /** 지금 발동 중인 이펙트 id (연습 모드 강조용). */
  liveEffect: EffectGestureId | null;
}

export function GuidePage({ liveLabel, liveEffect }: Props) {
  const [group, setGroup] = useState<GuideGroup | 'all'>('all');
  const [query, setQuery] = useState('');

  const entries = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return ALL_ENTRIES.filter((entry) => {
      if (group !== 'all' && entry.group !== group) return false;
      if (!keyword) return true;
      // 이름, 뜻, 만드는 방법 어디에서든 검색되게 합니다.
      return (
        entry.label.toLowerCase().includes(keyword) ||
        entry.meaning.toLowerCase().includes(keyword) ||
        entry.hint.toLowerCase().includes(keyword)
      );
    });
  }, [group, query]);

  /** 이 항목이 지금 카메라에 잡히고 있는지. */
  const isLive = (entry: GuideEntry): boolean => {
    if (entry.group === 'effect') return `effect-${liveEffect}` === entry.id;
    return liveLabel !== null && entry.label === liveLabel;
  };

  const groups: Array<GuideGroup | 'all'> = [
    'all',
    'consonant',
    'vowel',
    'word',
    'effect',
  ];

  return (
    <section className="guide" aria-label="수어 사전">
      <header className="guide__header">
        <div>
          <h2 className="guide__title">수어 사전</h2>
          <p className="guide__subtitle">
            이 앱이 인식하는 모든 손 모양과 뜻입니다. 카메라 앞에서 손을 만들면
            해당하는 카드가 실시간으로 강조됩니다.
          </p>
        </div>

        <label className="guide__search">
          <SearchIcon size={16} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="자모, 뜻, 손 모양으로 검색"
            aria-label="수어 검색"
          />
        </label>
      </header>

      {/* 자료 신뢰도 안내 — 사용자가 잘못된 손 모양을 배우지 않도록
          가장 먼저 보여줍니다. */}
      <div className="guide__disclaimer">
        <div>
          <strong>이 손 모양들을 그대로 믿지 마세요.</strong> 실제 지문자의 수형
          목록은 학술 자료에서 확인했지만, "어떤 글자가 어떤 수형을 쓰는지"
          대응표는 아직 확보하지 못했습니다. 그래서 대부분이 <strong>추정</strong>
          입니다. 각 카드의 배지에 신뢰도를 표시했고, 배지에 마우스를 올리면
          근거와 출처를 볼 수 있습니다. 실제 수어 학습은 한국농아인협회나
          국립국어원 한국수어사전을 이용해 주세요.
        </div>
      </div>

      <div className="guide__legend" aria-label="신뢰도 범례">
        <span className="guide__legend-item">
          <span
            className="guide__legend-dot"
            style={{ background: '#86efac' }}
          />
          자료 확인됨
        </span>
        <span className="guide__legend-item">
          <span
            className="guide__legend-dot"
            style={{ background: '#fde047' }}
          />
          추정 — 수형은 실재하나 글자 대응은 미확인
        </span>
        <span className="guide__legend-item">
          <span
            className="guide__legend-dot"
            style={{ background: '#fca5a5' }}
          />
          임시 배정 — 근거 없음, 학습용 사용 금지
        </span>
      </div>

      <div className="guide__tabs" role="tablist" aria-label="분류">
        {groups.map((g) => (
          <button
            key={g}
            type="button"
            role="tab"
            aria-selected={group === g}
            className={`chip ${group === g ? 'chip--active' : ''}`}
            onClick={() => setGroup(g)}
          >
            {g === 'all' ? '전체' : GROUP_LABEL[g]}
          </button>
        ))}
      </div>

      {group !== 'all' && (
        <p className="guide__group-desc">{GROUP_DESCRIPTION[group]}</p>
      )}

      {entries.length === 0 ? (
        <p className="guide__empty">
          "{query}"에 해당하는 손 모양이 없습니다. 다른 말로 검색해 보세요.
        </p>
      ) : (
        <ul className="guide__grid">
          {entries.map((entry) => (
            <GuideCard key={entry.id} entry={entry} live={isLive(entry)} />
          ))}
        </ul>
      )}

      <footer className="guide__note">
        <strong>알아두세요.</strong> 여기 실린 손 모양은 서로 구분하기 쉽도록
        단순화한 것으로, 공식 한국 지화와는 다릅니다. 실제 수어를 배우려면
        한국농아인협회 등 전문 기관의 자료를 참고해 주세요.
      </footer>
    </section>
  );
}

/**
 * 사전 카드 한 장.
 *
 * memo 로 감싼 이유: 연습 모드에서는 카메라가 초당 30번 인식 결과를 갱신합니다.
 * memo 가 없으면 그때마다 카드 37장과 SVG 60여 개가 전부 다시 그려집니다.
 * 이제는 `live` 값이 바뀐 카드 한 장만 다시 그립니다.
 */
const GuideCard = memo(function GuideCard({
  entry,
  live,
}: {
  entry: GuideEntry;
  live: boolean;
}) {
  return (
    <li className={`guide-card ${live ? 'guide-card--live' : ''}`}>
      <div className="guide-card__figure">
        <HandShape shape={entry.shape} size={78} active={live} />
      </div>

      <div className="guide-card__body">
        <div className="guide-card__head">
          <strong className="guide-card__label">{entry.label}</strong>
          <span className="guide-card__group">{GROUP_LABEL[entry.group]}</span>
          {entry.screenWide && (
            <span className="guide-card__badge" title="화면 전체 이펙트">
              <FullScreenIcon size={12} />
              전체
            </span>
          )}
        </div>

        <p className="guide-card__meaning">{entry.meaning}</p>
        <p className="guide-card__hint">{entry.hint}</p>

        {/* 신뢰도 — 이 앱에서 가장 정직해야 하는 부분입니다.
            "자료로 확인된 손 모양"과 "아직 추정인 손 모양"을 사용자가
            구분할 수 있어야 잘못된 것을 배우지 않습니다. */}
        {entry.group !== 'effect' && (
          <div
            className={`guide-card__confidence guide-card__confidence--${entry.confidence}`}
            title={`${CONFIDENCE_NOTE[entry.confidence]}\n\n근거: ${entry.rationale}\n출처: ${entry.source}`}
          >
            <span className="guide-card__confidence-dot" />
            {CONFIDENCE_LABEL[entry.confidence]}
            {entry.handshapeName && (
              <span className="guide-card__handshape">· {entry.handshapeName}</span>
            )}
          </div>
        )}
      </div>

      {live && (
        <span className="guide-card__live" aria-label="지금 인식 중">
          인식 중
        </span>
      )}
    </li>
  );
});
