// =============================================================================
// EffectLegend — 어떤 손 모양이 어떤 이펙트를 부르는지 보여주는 안내판
// =============================================================================
// 이모지 대신 HandShape로 실제 손 모양을 그려 보여줍니다. 이모지는 기기마다
// 생김새가 달라 "정확히 이 손 모양"을 전달하지 못하기 때문입니다.
//
// 현재 발동 중인 이펙트는 강조합니다. 사용자가 손 모양을 익히는 데 이 즉각적인
// 피드백이 가장 큰 도움이 됩니다.

import { getEffectCatalog } from '../effects/EffectManager';
import type { EffectGestureId } from '../types';
import { HandShape } from './HandShape';
import { FullScreenIcon } from './icons';

interface Props {
  /** 지금 발동 중인 이펙트 (없으면 null). */
  activeId: EffectGestureId | null;
}

const CATALOG = getEffectCatalog();
const ONE_HAND = CATALOG.filter((e) => e.shape.hands !== 2);
const TWO_HAND = CATALOG.filter((e) => e.shape.hands === 2);

export function EffectLegend({ activeId }: Props) {
  return (
    <section className="effect-legend" aria-label="이펙트 목록">
      <h2 className="effect-legend__title">손 모양 → 이펙트</h2>

      <div className="effect-legend__scroll">
        <EffectGroup
          title="한 손"
          description="손 주변에서 일어나는 이펙트"
          items={ONE_HAND}
          activeId={activeId}
        />
        <EffectGroup
          title="양 손 — 화면 전체 필살기"
          description="같은 손 모양을 양손으로 만들면 화면 전체로 커집니다"
          items={TWO_HAND}
          activeId={activeId}
        />
      </div>
    </section>
  );
}

function EffectGroup({
  title,
  description,
  items,
  activeId,
}: {
  title: string;
  description: string;
  items: typeof CATALOG;
  activeId: EffectGestureId | null;
}) {
  return (
    <div className="effect-legend__group">
      <div className="effect-legend__group-head">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <ul className="effect-legend__list">
        {items.map((effect) => (
          <li
            key={effect.id}
            className={`effect-legend__item ${
              activeId === effect.id ? 'effect-legend__item--active' : ''
            }`}
          >
            <HandShape
              shape={effect.shape}
              size={44}
              active={activeId === effect.id}
            />
            <div className="effect-legend__text">
              <strong className="effect-legend__label">
                {effect.label}
                {effect.screenWide && (
                  <span className="effect-legend__badge" title="화면 전체 이펙트">
                    <FullScreenIcon size={12} />
                    전체
                  </span>
                )}
              </strong>
              <span className="effect-legend__hint">{effect.hint}</span>
            </div>
            {activeId === effect.id && (
              <span className="effect-legend__live" aria-label="발동 중">
                발동 중
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
