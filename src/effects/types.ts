// =============================================================================
// 이펙트 공통 인터페이스
// =============================================================================
// 모든 이펙트는 "생명주기 3단계"를 가집니다.
//
//   onEnter — 손 모양이 처음 인식된 순간 (1회)   … 거미줄 발사, 핑거스냅
//   onHold  — 손 모양을 유지하는 동안 매 프레임  … 화염, 번개, 반짝임
//   onExit  — 손 모양이 풀린 순간 (1회)          … 충전한 에너지 방출
//
// 이렇게 나눠 두면 "한 번 터지는 이펙트"와 "계속 나오는 이펙트", 그리고
// "모았다가 터뜨리는 이펙트"를 같은 구조로 표현할 수 있습니다.

import type { EffectGestureId, GestureShape } from '../types';
import type { Point2D } from '../utils/coverFit';
import type { ParticleEngine } from './ParticleEngine';
import type { SoundService } from '../services/SoundService';
import type { ScreenShaker } from './ScreenEffects';

/** 이펙트 핸들러가 매 호출마다 받는 정보 묶음. */
export interface EffectContext {
  /** 파티클을 만들고 그리는 엔진. */
  engine: ParticleEngine;
  /** 효과음 재생기. */
  sound: SoundService;
  /** 화면 흔들림 제어기 (화면 전체 이펙트에서 사용). */
  shaker: ScreenShaker;

  /**
   * 이 이펙트를 발동시킨 손의 랜드마크 21개 (화면 픽셀 좌표).
   * 양손 이펙트(하트)의 경우 주 손이 들어옵니다.
   */
  points: Point2D[];
  /** 양손 이펙트를 위한 보조 손. 없으면 null. */
  secondPoints: Point2D[] | null;

  /** 손 크기(px). 이펙트 크기를 손 크기에 비례시키는 데 씁니다. */
  handScale: number;

  /** 캔버스 크기(px). */
  width: number;
  height: number;

  /** 이전 프레임과의 시간 간격(초). onHold에서 프레임 독립적 계산에 사용. */
  dt: number;
}

/** 이펙트 하나의 구현. */
export interface EffectInstance {
  /** 손 모양이 처음 인식된 순간 1회 호출. */
  onEnter?(ctx: EffectContext): void;
  /** 손 모양을 유지하는 동안 매 프레임 호출. */
  onHold?(ctx: EffectContext): void;
  /**
   * 손 모양이 풀린 순간 1회 호출.
   *
   * 손이 이미 화면에서 사라졌을 수 있으므로, EffectManager가 "마지막으로
   * 알고 있던" 컨텍스트를 대신 넘겨줍니다. 덕분에 에너지 방출처럼 손을 편
   * 위치에서 터져야 하는 이펙트도 정확한 좌표를 쓸 수 있습니다.
   */
  onExit?(ctx: EffectContext): void;
}

/** 이펙트 메타데이터 + 생성 함수. */
export interface EffectDefinition {
  id: EffectGestureId;
  /** UI에 표시할 이름. */
  label: string;
  /**
   * 어떤 손 모양을 만들어야 하는지 그림으로 보여주기 위한 데이터.
   * 이모지는 기기마다 모양이 달라 "정확히 이 손 모양"을 전달할 수 없어서,
   * 직접 그리는 방식으로 바꿨습니다.
   */
  shape: GestureShape;
  /** 어떤 손 모양을 만들어야 하는지 안내 문구. */
  hint: string;
  /** 화면 전체를 덮는 필살기인지 (UI에서 구분해 표시). */
  screenWide?: boolean;
  /**
   * 이펙트 인스턴스를 만듭니다.
   * 팩토리로 만드는 이유: 충전량 같은 내부 상태를 클로저에 담아두기 위해서입니다.
   * (전역 변수를 쓰지 않아 테스트와 재사용이 쉬워집니다.)
   */
  create(): EffectInstance;
}
