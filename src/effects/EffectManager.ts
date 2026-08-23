// =============================================================================
// EffectManager — 감지 이벤트와 이펙트, 캔버스를 연결하는 지휘자
// =============================================================================
// 하는 일:
//   1. EffectGestureDetector의 enter/hold/exit 이벤트를 구독합니다.
//   2. 해당 이벤트를 알맞은 이펙트 구현에 전달합니다.
//   3. requestAnimationFrame 루프를 돌며 파티클을 갱신하고 캔버스에 그립니다.
//
// 왜 MediaPipe 콜백이 아니라 별도의 rAF 루프를 쓰나요?
//   MediaPipe는 카메라 프레임 속도(≈30fps)로 동작하지만, 파티클은 60fps로
//   움직여야 부드럽습니다. 그래서 "최신 손 좌표"만 저장해 두고, 그리기는
//   독립적인 루프에서 처리합니다.

import type { EffectGestureId, GestureShape, HandLandmarks } from '../types';
import type { CoverFit } from '../utils/coverFit';
import { projectHand, projectLandmark } from '../utils/coverFit';
import { LM, distance2D } from '../utils/landmarkUtils';
import type { EffectGestureDetector } from '../services/EffectGestureDetector';
import type { SoundService } from '../services/SoundService';
import { ParticleEngine } from './ParticleEngine';
import { ScreenShaker } from './ScreenEffects';
import type { EffectContext, EffectDefinition, EffectInstance } from './types';

import { webShooterEffect } from './definitions/webShooter';
import { fireEffect } from './definitions/fire';
import { lightningEffect } from './definitions/lightning';
import { sparkleEffect } from './definitions/sparkle';
import { energyEffect } from './definitions/energy';
import { heartEffect } from './definitions/heart';
import { snapEffect } from './definitions/snap';
import { SCREEN_WIDE_EFFECTS } from './definitions/screenWide';

/** 등록된 모든 이펙트. 새 이펙트를 만들면 여기에 추가하면 끝입니다. */
export const EFFECT_DEFINITIONS: EffectDefinition[] = [
  // --- 한 손 (손 주변 국소 이펙트) ---
  webShooterEffect,
  fireEffect,
  lightningEffect,
  sparkleEffect,
  energyEffect,
  snapEffect,
  // --- 양 손 ---
  heartEffect,
  // --- 양 손 필살기 (화면 전체) ---
  ...SCREEN_WIDE_EFFECTS,
];

export class EffectManager {
  private readonly engine = new ParticleEngine();
  /** 화면 흔들림 제어기 — 화면 전체 이펙트가 사용합니다. */
  private readonly shaker = new ScreenShaker();
  /** id → 이펙트 인스턴스 (충전량 같은 내부 상태를 유지). */
  private readonly instances = new Map<EffectGestureId, EffectInstance>();
  /** 이벤트 구독 해제 함수들. */
  private unsubscribers: Array<() => void> = [];

  private canvas: HTMLCanvasElement | null = null;
  private ctx2d: CanvasRenderingContext2D | null = null;
  private rafId: number | null = null;
  private lastFrameTime = 0;

  /** MediaPipe가 준 최신 손 좌표(정규화). */
  private hands: HandLandmarks[] = [];
  /** 화면 좌표 변환 정보. */
  private fit: CoverFit | null = null;
  /** 마지막으로 만든 컨텍스트 — 손이 사라진 뒤 onExit에 넘겨줍니다. */
  private lastContext: EffectContext | null = null;
  /** 가장 최근 프레임 간격(초). onHold에서 프레임 독립 계산에 씁니다. */
  private currentDt = 1 / 60;
  /**
   * 이펙트 모드일 때만 true.
   * 번역 모드에서도 루프는 계속 돌지만, 이 값이 false면 손 모양을 판정하지
   * 않으므로 이펙트가 잘못 발동하지 않습니다.
   */
  private enabled = false;

  constructor(
    private readonly detector: EffectGestureDetector,
    private readonly sound: SoundService,
  ) {
    for (const def of EFFECT_DEFINITIONS) {
      this.instances.set(def.id, def.create());
    }
    this.subscribe();
  }

  /** detector 이벤트를 이펙트 호출로 연결합니다. */
  private subscribe(): void {
    const { events } = this.detector;

    this.unsubscribers.push(
      events.on('enter', ({ id, handIndex }) => {
        const ctx = this.buildContext(handIndex);
        if (ctx) this.instances.get(id)?.onEnter?.(ctx);
      }),
      events.on('hold', ({ id, handIndex }) => {
        const ctx = this.buildContext(handIndex);
        if (ctx) this.instances.get(id)?.onHold?.(ctx);
      }),
      events.on('exit', ({ id, handIndex }) => {
        // 손이 이미 사라졌을 수 있으므로 마지막 컨텍스트를 대신 씁니다.
        const ctx = this.buildContext(handIndex) ?? this.lastContext;
        if (ctx) this.instances.get(id)?.onExit?.(ctx);
        // 지속음이 남지 않도록 안전하게 정리합니다.
        this.sound.stopLoop();
      }),
    );
  }

  /**
   * 캔버스를 연결하고 렌더 루프를 시작합니다.
   *
   * @param canvas 파티클을 그릴 캔버스
   * @param stage  화면 흔들림을 적용할 요소(보통 카메라 컨테이너).
   *               캔버스 안에서 좌표만 옮기면 파티클만 흔들리고 카메라 영상은
   *               가만히 있어 어색하므로, 컨테이너를 통째로 흔듭니다.
   */
  attach(canvas: HTMLCanvasElement, stage?: HTMLElement | null): void {
    this.canvas = canvas;
    this.ctx2d = canvas.getContext('2d');
    this.shaker.attach(stage ?? canvas.parentElement);
    this.start();
  }

  /** MediaPipe 프레임 결과를 저장합니다 (그리기는 rAF 루프가 담당). */
  setFrame(hands: HandLandmarks[], fit: CoverFit): void {
    this.hands = hands;
    this.fit = fit;
  }

  /**
   * 이펙트 모드 진입/이탈.
   * 끌 때는 진행 중이던 이펙트를 정리하고 화면을 비웁니다.
   */
  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) {
      this.hands = [];
      this.clear();
      this.renderFrame(); // 남아 있던 그림을 즉시 지웁니다.
    }
  }

  /** 현재 살아 있는 파티클 수 (디버그 UI용). */
  getParticleCount(): number {
    return this.engine.particleCount + this.engine.entityCount;
  }

  /**
   * 이펙트 핸들러에 넘길 컨텍스트를 만듭니다.
   * 손 좌표가 없으면 null을 반환합니다.
   */
  private buildContext(handIndex: number): EffectContext | null {
    const canvas = this.canvas;
    const fit = this.fit;
    if (!canvas || !fit) return null;

    const hand = this.hands[handIndex];
    if (!hand) return null;

    // 정규화 좌표 → 화면 픽셀 좌표.
    const points = projectHand(hand, fit);
    // 양손 이펙트를 위해 다른 손도 넘겨줍니다.
    const otherIndex = handIndex === 0 ? 1 : 0;
    const other = this.hands[otherIndex];
    const secondPoints = other ? projectHand(other, fit) : null;

    // 손 크기를 픽셀 단위로 환산 (이펙트 크기 스케일링에 사용).
    const wristPx = projectLandmark(hand[LM.WRIST], fit);
    const mcpPx = projectLandmark(hand[LM.MIDDLE_MCP], fit);
    const handScale = Math.max(20, distance2D(
      { x: wristPx.x, y: wristPx.y, z: 0 },
      { x: mcpPx.x, y: mcpPx.y, z: 0 },
    ));

    const ctx: EffectContext = {
      engine: this.engine,
      sound: this.sound,
      shaker: this.shaker,
      points,
      secondPoints,
      handScale,
      width: canvas.width,
      height: canvas.height,
      dt: this.currentDt,
    };
    this.lastContext = ctx;
    return ctx;
  }

  /** 렌더 루프 시작. */
  private start(): void {
    if (this.rafId !== null) return;
    this.lastFrameTime = performance.now();

    const loop = (now: number) => {
      // 탭 전환 후 복귀하면 dt가 몇 초씩 튈 수 있으므로 상한을 둡니다.
      const dt = Math.min(0.05, (now - this.lastFrameTime) / 1000);
      this.lastFrameTime = now;
      this.currentDt = dt;

      // 1) 손 모양을 판정하고 이벤트를 발행합니다.
      //    (이벤트 핸들러가 파티클을 생성합니다)
      if (this.enabled) this.detector.update(this.hands);

      // 2) 물리 갱신 + 그리기
      //    이펙트 모드를 껐어도 이미 떠 있던 파티클은 자연스럽게 사라지도록
      //    한동안 계속 갱신합니다.
      this.engine.update(dt);
      // 화면 흔들림은 캔버스가 아니라 DOM 요소에 적용합니다.
      this.shaker.update(dt);
      this.renderFrame();

      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  /** 캔버스를 지우고 다시 그립니다. */
  private renderFrame(): void {
    const canvas = this.canvas;
    const ctx = this.ctx2d;
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.engine.render(ctx);
  }

  /** 파티클을 모두 지웁니다 (모드 전환/초기화). */
  clear(): void {
    this.engine.clear();
    this.detector.reset();
    this.sound.stopLoop();
    this.shaker.reset();
  }

  /** 렌더 루프를 멈추고 구독을 해제합니다. */
  dispose(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    for (const off of this.unsubscribers) off();
    this.unsubscribers = [];
    this.engine.clear();
    this.sound.stopLoop();
    this.shaker.reset();
    this.shaker.attach(null);
    this.canvas = null;
    this.ctx2d = null;
    this.lastContext = null;
  }
}

/** 이펙트 목록을 UI(도움말 패널, 사전 페이지)에서 쓰기 좋게 반환합니다. */
export function getEffectCatalog(): Array<{
  id: EffectGestureId;
  label: string;
  shape: GestureShape;
  hint: string;
  screenWide: boolean;
}> {
  return EFFECT_DEFINITIONS.map(({ id, label, shape, hint, screenWide }) => ({
    id,
    label,
    shape,
    hint,
    screenWide: Boolean(screenWide),
  }));
}
