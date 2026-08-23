// =============================================================================
// CoachService — 손 모양을 어떻게 고쳐야 하는지 알려주는 코치
// =============================================================================
// 배우기 모드의 핵심입니다.
//
// 그냥 "맞음 / 틀림"만 보여주면 처음 배우는 사람은 막힙니다. 뭐가 틀렸는지
// 모르니까 손을 이리저리 흔들어 볼 수밖에 없습니다. 그래서 이 모듈은
// **무엇을 고쳐야 하는지 한 문장으로** 짚어 줍니다.
//
//   "새끼손가락을 접으세요"
//   "손끝을 오른쪽으로 향하게 하세요"
//   "좋아요! 그대로 1초만 유지하세요"
//
// 판정 기준은 분류기와 똑같은 점수 함수(rule.score)를 씁니다. 그래야
// "연습에서는 되는데 실제로는 안 되는" 일이 생기지 않습니다.

import { getRuleByLabel } from '../data/koreanGestures';
import type { GestureRule } from '../data/koreanGestures';
import {
  LM,
  directionScore,
  fingerDirection,
  getFingerFlexions,
  handDirection,
  indexDirection,
  type Direction4,
} from '../utils/landmarkUtils';
import type { FingerSpec, HandLandmarks } from '../types';

/** 손가락 하나에 대한 판정. */
export type FingerStatus = 'ok' | 'should-extend' | 'should-curl' | 'unknown';

/** 코치가 매 프레임 돌려주는 결과. */
export interface CoachFeedback {
  /** 자세를 충분히 유지해서 통과했는가. */
  passed: boolean;
  /** 지금 점수 (0~1). 분류기가 쓰는 것과 같은 값입니다. */
  score: number;
  /** 화면에 크게 보여줄 한 문장. */
  hint: string;
  /** 잘하고 있는 중인지 (안내 문구 색을 바꾸는 데 사용). */
  tone: 'idle' | 'adjusting' | 'close' | 'success';
  /** 손가락별 판정 — 그림에 표시합니다. */
  fingers: Record<keyof FingerSpec, FingerStatus>;
  /** 방향 판정. 방향 조건이 없는 글자는 'none'. */
  direction: 'none' | 'ok' | 'wrong';
  /** 자세 유지 진행도 0~1. 1이 되면 통과합니다. */
  holdProgress: number;
}

/** 이 점수를 넘으면 "맞게 하고 있다"로 봅니다. */
const PASS_SCORE = 0.75;
/** 통과하려면 이만큼(초) 유지해야 합니다. */
const HOLD_SECONDS = 0.9;
/** 자세가 흐트러졌을 때 유지 시간이 줄어드는 속도 배수. */
const DECAY_RATE = 2;

const FINGER_NAMES: Record<keyof FingerSpec, string> = {
  thumb: '엄지',
  index: '검지',
  middle: '중지',
  ring: '약지',
  pinky: '새끼손가락',
};

const DIRECTION_NAMES: Record<Direction4, string> = {
  up: '위',
  down: '아래',
  left: '왼쪽',
  right: '오른쪽',
};

/** 손가락을 검사하는 순서. 큰 손가락부터 짚어주는 편이 알아듣기 쉽습니다. */
const FINGER_ORDER: Array<keyof FingerSpec> = [
  'thumb',
  'index',
  'middle',
  'ring',
  'pinky',
];

/**
 * 손이 안 보일 때의 상태.
 *
 * 예전에는 여기서 전부 'ok' 를 돌려줬는데, 그러면 손을 들지도 않았는데
 * 손가락이 전부 "좋아요"로 표시돼서 사용자가 "다 맞는데 왜 안 넘어가지?"
 * 하고 헤매게 됩니다. 모르는 건 모른다고 표시해야 합니다.
 */
const UNKNOWN_FINGERS: Record<keyof FingerSpec, FingerStatus> = {
  thumb: 'unknown',
  index: 'unknown',
  middle: 'unknown',
  ring: 'unknown',
  pinky: 'unknown',
};

const EMPTY_FINGERS: Record<keyof FingerSpec, FingerStatus> = {
  thumb: 'ok',
  index: 'ok',
  middle: 'ok',
  ring: 'ok',
  pinky: 'ok',
};

export class CoachService {
  /** 지금 연습 중인 글자. */
  private target: GestureRule | null = null;
  /** 올바른 자세를 유지한 시간(초). */
  private holdTime = 0;
  /** 이미 통과했는지 (한 번 통과하면 다음 목표로 넘어갈 때까지 유지). */
  private done = false;

  /** 연습할 글자를 정합니다. 진행 상태는 초기화됩니다. */
  setTarget(label: string | null): void {
    const next = label ? (getRuleByLabel(label) ?? null) : null;
    if (next === this.target) return;
    this.target = next;
    this.holdTime = 0;
    this.done = false;
  }

  getTarget(): GestureRule | null {
    return this.target;
  }

  /** 진행 상태만 되돌립니다 (다시 연습하기). */
  reset(): void {
    this.holdTime = 0;
    this.done = false;
  }

  /**
   * 한 프레임을 처리합니다.
   *
   * @param hands MediaPipe 가 준 손들
   * @param dt    이전 프레임과의 간격(초)
   */
  update(hands: HandLandmarks[], dt: number): CoachFeedback {
    const target = this.target;

    // --- 연습할 글자가 없을 때 ---
    if (!target) {
      return this.idle('연습할 글자를 골라주세요');
    }

    // --- 손이 안 보일 때 ---
    if (hands.length === 0) {
      // 손이 사라지면 유지 시간을 빠르게 되돌립니다.
      this.holdTime = Math.max(0, this.holdTime - dt * DECAY_RATE);
      return this.idle('손을 카메라 앞에 보여주세요');
    }

    const lm = hands[0];
    const score = target.score(lm);
    const fingers = this.checkFingers(lm, target);
    const direction = this.checkDirection(lm, target);

    // --- 자세 유지 시간 갱신 ---
    if (score >= PASS_SCORE) {
      this.holdTime = Math.min(HOLD_SECONDS, this.holdTime + dt);
    } else {
      this.holdTime = Math.max(0, this.holdTime - dt * DECAY_RATE);
    }
    const holdProgress = this.holdTime / HOLD_SECONDS;

    if (holdProgress >= 1) this.done = true;

    if (this.done) {
      return {
        passed: true,
        score,
        hint: '잘하셨어요!',
        tone: 'success',
        fingers,
        direction,
        holdProgress: 1,
      };
    }

    // --- 무엇을 고쳐야 하는지 한 문장으로 ---
    const hint = this.buildHint(fingers, direction, target, score, holdProgress);
    const tone: CoachFeedback['tone'] =
      score >= PASS_SCORE ? 'close' : score >= 0.5 ? 'adjusting' : 'adjusting';

    return { passed: false, score, hint, tone, fingers, direction, holdProgress };
  }

  /** 손이 없거나 목표가 없을 때의 기본 응답. */
  private idle(hint: string): CoachFeedback {
    return {
      passed: this.done,
      score: 0,
      hint,
      tone: 'idle',
      fingers: { ...UNKNOWN_FINGERS },
      direction: 'none',
      holdProgress: this.holdTime / HOLD_SECONDS,
    };
  }

  /** 손가락 하나하나가 목표와 맞는지 검사합니다. */
  private checkFingers(
    lm: HandLandmarks,
    target: GestureRule,
  ): Record<keyof FingerSpec, FingerStatus> {
    const flex = getFingerFlexions(lm);
    const want = target.shape.fingers;
    const result = { ...EMPTY_FINGERS };

    for (const key of FINGER_ORDER) {
      const shouldExtend = want[key];
      const actual = flex[key];

      if (shouldExtend) {
        // 갈퀴형처럼 "첫마디만 펴는" 모양은 bent 도 정답입니다.
        const ok = actual === 'extended' || actual === 'bent';
        result[key] = ok ? 'ok' : 'should-extend';
      } else {
        result[key] = actual === 'curled' ? 'ok' : 'should-curl';
      }
    }
    return result;
  }

  /** 손이 향한 방향이 맞는지 검사합니다. */
  private checkDirection(
    lm: HandLandmarks,
    target: GestureRule,
  ): CoachFeedback['direction'] {
    const dir = target.shape.direction;
    if (!dir) return 'none';

    // 어느 손가락으로 방향을 재는지는 손 모양에 따라 다릅니다.
    const vec = target.shape.fingers.index
      ? indexDirection(lm)
      : target.shape.fingers.pinky
        ? fingerDirection(lm, LM.PINKY_MCP, LM.PINKY_TIP)
        : target.shape.fingers.thumb
          ? fingerDirection(lm, LM.THUMB_MCP, LM.THUMB_TIP)
          : handDirection(lm);

    return directionScore(vec, dir as Direction4) >= 0.6 ? 'ok' : 'wrong';
  }

  /**
   * 가장 중요한 교정 안내 하나를 고릅니다.
   *
   * 한 번에 여러 개를 말하면 오히려 헷갈립니다. "지금 이것 하나만 고치면
   * 된다"는 식으로 하나씩 짚어 줍니다.
   */
  private buildHint(
    fingers: Record<keyof FingerSpec, FingerStatus>,
    direction: CoachFeedback['direction'],
    target: GestureRule,
    score: number,
    holdProgress: number,
  ): string {
    // 1) 이미 맞게 하고 있으면 유지하라고 알려줍니다.
    if (score >= PASS_SCORE) {
      const remaining = Math.max(0, 1 - holdProgress);
      return remaining > 0.5
        ? '좋아요! 그대로 유지하세요'
        : '조금만 더 유지하세요';
    }

    // 2) 펴야 하는데 접혀 있는 손가락 (보통 이게 가장 큰 차이입니다)
    const toExtend = FINGER_ORDER.filter((k) => fingers[k] === 'should-extend');
    if (toExtend.length > 0) {
      const names = toExtend.map((k) => FINGER_NAMES[k]);
      return names.length === 1
        ? `${names[0]}를 펴세요`
        : `${names.join(', ')}를 펴세요`;
    }

    // 3) 접어야 하는데 펴져 있는 손가락
    const toCurl = FINGER_ORDER.filter((k) => fingers[k] === 'should-curl');
    if (toCurl.length > 0) {
      const names = toCurl.map((k) => FINGER_NAMES[k]);
      return names.length === 1
        ? `${names[0]}를 접으세요`
        : `${names.join(', ')}를 접으세요`;
    }

    // 4) 손가락은 맞는데 방향이 틀린 경우
    if (direction === 'wrong' && target.shape.direction) {
      const dirName = DIRECTION_NAMES[target.shape.direction as Direction4];
      return `손끝을 ${dirName}쪽으로 향하게 하세요`;
    }

    // 5) 손가락과 방향은 맞는데 점수가 낮은 경우 — 세부 자세 문제입니다.
    if (target.shape.spread === 'narrow') {
      return '두 손가락을 서로 붙여보세요';
    }
    if (target.shape.spread === 'wide') {
      return '두 손가락을 더 벌려보세요';
    }
    if (target.shape.pinch) {
      const other = target.shape.pinch === 'index' ? '검지' : '중지';
      return `엄지와 ${other} 끝을 맞대어 동그라미를 만드세요`;
    }
    if (target.shape.claw) {
      return '손가락 첫마디만 세우고 끝은 굽혀 갈퀴 모양을 만드세요';
    }

    // 6) 그 밖에는 손을 잘 보이게 하라고 안내합니다.
    return '손 전체가 화면에 들어오도록 위치를 조정해보세요';
  }
}
