// =============================================================================
// EffectGestureDetector — 손 모양을 "이벤트"로 바꿔주는 모듈
// =============================================================================
// 이 모듈은 매 프레임 손 모양을 점수화한 뒤, 상태가 바뀌는 순간에만
// 이벤트를 발행합니다.
//
//   enter — 새로운 손 모양이 안정적으로 인식됨
//   hold  — 그 손 모양이 유지되는 동안 매 프레임
//   exit  — 손 모양이 풀림
//
// 이렇게 "상태"가 아니라 "변화"를 알려주면, 이펙트 쪽은 발사/지속/방출을
// 자연스럽게 구현할 수 있고 서로의 코드를 몰라도 됩니다.
//
// 떨림 방지:
//   손은 미세하게 움직이므로 한 프레임만 보고 판단하면 이펙트가 깜빡입니다.
//   그래서 ENTER_FRAMES 만큼 연속 인식돼야 시작하고, EXIT_FRAMES 만큼 연속
//   미인식돼야 끝냅니다(히스테리시스).

import { EventBus } from '../core/EventBus';
import { TWO_HAND_UPGRADE } from '../types';
import type { EffectGestureId, HandLandmarks } from '../types';
import {
  LM,
  distance2D,
  getFingerState,
  handSize,
  normalizedGap,
  thumbIndexPinch,
  thumbMiddlePinch,
} from '../utils/landmarkUtils';

/**
 * 이 detector가 발행하는 이벤트 목록.
 *
 * `interface`가 아니라 `type`으로 선언한 이유: TypeScript에서 interface는
 * 암묵적 인덱스 시그니처를 갖지 않아 EventBus의 `Record<string, unknown>`
 * 제약을 만족하지 못합니다. type 별칭은 이 제약을 통과합니다.
 */
export type EffectGestureEvents = {
  enter: { id: EffectGestureId; handIndex: number; confidence: number };
  hold: { id: EffectGestureId; handIndex: number; confidence: number };
  exit: { id: EffectGestureId; handIndex: number };
};

/** 이펙트 시작에 필요한 연속 인식 프레임 수 (반응성을 위해 짧게). */
const ENTER_FRAMES = 3;
/** 이펙트 종료에 필요한 연속 미인식 프레임 수 (깜빡임 방지를 위해 길게). */
const EXIT_FRAMES = 5;
/**
 * 이 점수 미만이면 인식하지 않습니다.
 *
 * 0.8은 "손가락 5개 중 1개까지는 틀려도 인정"에 해당합니다. 이보다 낮추면
 * 손가락 2개가 어긋나도 통과해서 엉뚱한 이펙트가 발동합니다.
 */
const MIN_SCORE = 0.8;

/** 감지 후보 하나. */
interface Candidate {
  id: EffectGestureId;
  score: number;
  handIndex: number;
}

export class EffectGestureDetector {
  /** 외부에서 구독할 이벤트 버스. */
  readonly events = new EventBus<EffectGestureEvents>();

  /** 현재 활성화된 제스처. */
  private active: { id: EffectGestureId; handIndex: number } | null = null;
  /** 활성 후보가 연속으로 잡힌 프레임 수. */
  private enterStreak = 0;
  /** 후보가 연속으로 안 잡힌 프레임 수. */
  private exitStreak = 0;
  /** enter 대기 중인 후보. */
  private pendingId: EffectGestureId | null = null;
  /** 마지막으로 계산된 점수 (UI 표시용). */
  private lastConfidence = 0;

  /** 현재 활성 제스처 (UI 표시용). */
  getActive(): { id: EffectGestureId; handIndex: number } | null {
    return this.active;
  }

  /** 현재 신뢰도 (UI 표시용). */
  getConfidence(): number {
    return this.lastConfidence;
  }

  /**
   * 한 프레임을 처리하고 필요하면 이벤트를 발행합니다.
   * @param hands 감지된 손들의 랜드마크
   */
  update(hands: HandLandmarks[]): void {
    const best = hands.length === 0 ? null : this.findBest(hands);
    this.lastConfidence = best?.score ?? 0;

    // --- 활성 제스처가 없는 경우: enter 판정 ---
    if (!this.active) {
      if (best) {
        // 같은 후보가 연속으로 잡혀야 시작합니다.
        if (this.pendingId === best.id) this.enterStreak += 1;
        else {
          this.pendingId = best.id;
          this.enterStreak = 1;
        }

        if (this.enterStreak >= ENTER_FRAMES) {
          this.active = { id: best.id, handIndex: best.handIndex };
          this.enterStreak = 0;
          this.pendingId = null;
          this.exitStreak = 0;
          this.events.emit('enter', {
            id: best.id,
            handIndex: best.handIndex,
            confidence: best.score,
          });
        }
      } else {
        this.pendingId = null;
        this.enterStreak = 0;
      }
      return;
    }

    // --- 활성 제스처가 있는 경우: hold 또는 exit 판정 ---
    if (best && best.id === this.active.id) {
      // 같은 제스처가 계속 잡히는 중 — 손 인덱스는 바뀔 수 있으므로 갱신합니다.
      this.active.handIndex = best.handIndex;
      this.exitStreak = 0;
      this.events.emit('hold', {
        id: best.id,
        handIndex: best.handIndex,
        confidence: best.score,
      });
      return;
    }

    // 다른 제스처가 잡혔거나 아무것도 못 잡음 → 종료 카운트를 올립니다.
    this.exitStreak += 1;
    if (this.exitStreak >= EXIT_FRAMES) {
      const finished = this.active;
      this.active = null;
      this.exitStreak = 0;
      this.events.emit('exit', {
        id: finished.id,
        handIndex: finished.handIndex,
      });
    } else {
      // 아직 종료가 확정되지 않았으면 이전 제스처를 유지합니다
      // (손이 잠깐 흔들려 인식이 끊긴 경우를 버팁니다).
      this.events.emit('hold', {
        id: this.active.id,
        handIndex: this.active.handIndex,
        confidence: this.lastConfidence,
      });
    }
  }

  /** 모든 손을 검사해 가장 점수가 높은 후보를 찾습니다. */
  private findBest(hands: HandLandmarks[]): Candidate | null {
    // -------------------------------------------------------------------------
    // 1) 양손 제스처를 먼저 확인합니다 — 한손 규칙보다 항상 우선합니다.
    // -------------------------------------------------------------------------
    if (hands.length >= 2) {
      // 1-a) 하트: 두 손의 손끝이 서로 맞닿는 특수한 모양.
      const heartScore = scoreHeart(hands[0], hands[1]);
      if (heartScore >= MIN_SCORE) {
        return { id: 'heart', score: heartScore, handIndex: 0 };
      }

      // 1-b) 양손이 "같은 모양"이면 화면 전체 필살기로 승급시킵니다.
      //      예) 양손 주먹 → 화면 균열, 양손 손바닥 → 불바다
      const left = bestOfHand(hands[0]);
      const right = bestOfHand(hands[1]);
      if (
        left &&
        right &&
        left.id === right.id &&
        left.score >= MIN_SCORE &&
        right.score >= MIN_SCORE
      ) {
        const upgraded = TWO_HAND_UPGRADE[left.id];
        if (upgraded) {
          return {
            id: upgraded,
            score: Math.min(left.score, right.score),
            handIndex: 0,
          };
        }
      }
    }

    // -------------------------------------------------------------------------
    // 2) 한손 제스처
    // -------------------------------------------------------------------------
    let best: Candidate | null = null;
    for (let i = 0; i < hands.length; i++) {
      const top = bestOfHand(hands[i]);
      if (!top || top.score < MIN_SCORE) continue;
      if (!best || top.score > best.score) {
        best = { id: top.id, score: top.score, handIndex: i };
      }
    }
    return best;
  }

  /** 상태를 완전히 초기화합니다 (모드 전환 시). */
  reset(): void {
    if (this.active) {
      this.events.emit('exit', {
        id: this.active.id,
        handIndex: this.active.handIndex,
      });
    }
    this.active = null;
    this.pendingId = null;
    this.enterStreak = 0;
    this.exitStreak = 0;
    this.lastConfidence = 0;
  }
}

// -----------------------------------------------------------------------------
// 점수 계산 함수들
// -----------------------------------------------------------------------------

/** 손가락 패턴이 정확히 일치하는 비율(0~1). */
function patternScore(
  actual: ReturnType<typeof getFingerState>,
  expected: Partial<ReturnType<typeof getFingerState>>,
): number {
  let matched = 0;
  let checked = 0;
  for (const key of ['thumb', 'index', 'middle', 'ring', 'pinky'] as const) {
    if (expected[key] === undefined) continue;
    checked += 1;
    if (actual[key] === expected[key]) matched += 1;
  }
  return checked === 0 ? 0 : matched / checked;
}


/** 한 손에서 가장 점수가 높은 제스처 하나를 반환합니다. */
function bestOfHand(
  lm: HandLandmarks,
): { id: EffectGestureId; score: number } | null {
  let best: { id: EffectGestureId; score: number } | null = null;
  for (const candidate of scoreSingleHand(lm)) {
    if (!best || candidate.score > best.score) best = candidate;
  }
  return best;
}

/** 한 손에 대해 모든 한손 이펙트 제스처를 점수화합니다. */
function scoreSingleHand(
  lm: HandLandmarks,
): Array<{ id: EffectGestureId; score: number }> {
  const f = getFingerState(lm);
  const results: Array<{ id: EffectGestureId; score: number }> = [];

  // 💥 핑거스냅 — 엄지와 중지를 "펴서" 맞댄 모양.
  //
  // 주의: 손끝이 가까운지만 보면 오인식이 납니다. 손가락을 접으면 접힌
  // 엄지와 접힌 중지가 자연스럽게 붙기 때문에, 검지를 펴서 무언가를
  // 가리키기만 해도 스냅으로 잡혀버립니다. 그래서 "두 손가락이 모두 펴진
  // 상태"라는 조건을 반드시 함께 확인합니다.
  if (
    f.thumb &&
    f.middle &&
    thumbMiddlePinch(lm) &&
    !thumbIndexPinch(lm) // 엄지+검지 동그라미(OK)와 구별
  ) {
    // 가까울수록 높은 점수.
    const gap = normalizedGap(lm, LM.THUMB_TIP, LM.MIDDLE_TIP);
    results.push({ id: 'snap', score: Math.min(1, 1.2 - gap) });
  }

  // 🕸️ 거미줄 — 엄지·검지·새끼를 펴고 중지·약지는 접기 (🤟)
  results.push({
    id: 'web',
    score: patternScore(f, {
      thumb: true,
      index: true,
      middle: false,
      ring: false,
      pinky: true,
    }),
  });

  // 🔥 화염 — 다섯 손가락 모두 펴기
  results.push({
    id: 'fire',
    score: patternScore(f, {
      thumb: true,
      index: true,
      middle: true,
      ring: true,
      pinky: true,
    }),
  });

  // ⚡ 번개 — 검지 + 중지만 펴기 (V)
  results.push({
    id: 'lightning',
    score: patternScore(f, {
      index: true,
      middle: true,
      ring: false,
      pinky: false,
    }),
  });

  // ✨ 반짝임 — 검지만 펴기
  results.push({
    id: 'sparkle',
    score: patternScore(f, {
      thumb: false,
      index: true,
      middle: false,
      ring: false,
      pinky: false,
    }),
  });

  // ✊ 에너지 — 주먹
  results.push({
    id: 'energy',
    score: patternScore(f, {
      thumb: false,
      index: false,
      middle: false,
      ring: false,
      pinky: false,
    }),
  });

  return results;
}

/**
 * 💖 양손 하트 점수.
 * 두 손의 검지끝끼리, 엄지끝끼리 가까워야 합니다.
 */
function scoreHeart(a: HandLandmarks, b: HandLandmarks): number {
  // 두 손의 평균 크기를 기준으로 거리를 정규화합니다.
  const scale = (handSize(a) + handSize(b)) / 2;
  const indexGap = distance2D(a[LM.INDEX_TIP], b[LM.INDEX_TIP]) / scale;
  const thumbGap = distance2D(a[LM.THUMB_TIP], b[LM.THUMB_TIP]) / scale;

  // 손끝이 손 크기의 0.8배 이내로 가까우면 만점, 2배 이상이면 0점.
  const toScore = (gap: number) =>
    Math.min(1, Math.max(0, (2.0 - gap) / 1.2));

  const indexScore = toScore(indexGap);
  const thumbScore = toScore(thumbGap);

  // 둘 다 가까워야 하므로 평균이 아니라 더 낮은 쪽을 기준으로 삼습니다.
  return Math.min(indexScore, thumbScore);
}
