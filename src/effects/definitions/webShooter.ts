// =============================================================================
// 🕸️ 거미줄 발사 (스파이더맨)
// =============================================================================
// 손 모양: 엄지 + 검지 + 새끼를 펴고 중지 + 약지는 접기 (🤟 모양)
//          스파이더맨이 손목의 웹슈터를 누를 때 나오는 바로 그 모양입니다.
//
// 연출 순서:
//   1. 손목에서 손이 향한 방향으로 거미줄 줄기가 뻗어 나갑니다 (0.12초).
//   2. 끝에 닿으면 거미줄이 "철퍽" 붙는 모양(스플랫)이 생깁니다.
//   3. 잠시 유지되다가 서서히 사라집니다.
//
// 발사 순간에만 동작하므로 onEnter만 구현합니다. 손 모양을 유지해도 연발되지
// 않고, 손을 풀었다 다시 만들면 다시 발사됩니다.

import { LM } from '../../utils/landmarkUtils';
import type { Point2D } from '../../utils/coverFit';
import type { Entity } from '../ParticleEngine';
import { rand, randSpread } from '../ParticleEngine';
import type { EffectContext, EffectDefinition } from '../types';

/** 거미줄 줄기 하나를 표현하는 엔티티. */
class WebStrand implements Entity {
  /** 거미줄은 흰색 불투명이라 加算 합성을 쓰지 않습니다. */
  additive = false;

  private elapsed = 0;

  // 단계별 지속 시간(초)
  private static readonly EXTEND = 0.12;
  private static readonly HOLD = 0.55;
  private static readonly FADE = 0.35;

  /** 줄기를 몇 조각으로 나눠 그릴지. */
  private static readonly SEGMENTS = 16;

  /** 각 마디의 좌우 흔들림(px). 매 프레임 새로 뽑으면 떨려 보이므로 고정합니다. */
  private readonly wobble: number[];
  /** 스플랫에서 뻗어 나가는 짧은 가닥들의 각도/길이. */
  private readonly splatSpokes: Array<{ angle: number; len: number }>;

  constructor(
    private readonly originX: number,
    private readonly originY: number,
    private readonly dirX: number,
    private readonly dirY: number,
    private readonly length: number,
    private readonly thickness: number,
  ) {
    const segs = WebStrand.SEGMENTS;
    this.wobble = Array.from({ length: segs + 1 }, (_, i) =>
      // 시작점과 끝점은 흔들리지 않아야 손목/스플랫에 정확히 붙습니다.
      i === 0 || i === segs ? 0 : randSpread(thickness * 1.6),
    );
    this.splatSpokes = Array.from({ length: 9 }, (_, i) => ({
      angle: (i / 9) * Math.PI * 2 + rand(-0.2, 0.2),
      len: rand(0.6, 1.4),
    }));
  }

  update(dt: number): boolean {
    this.elapsed += dt;
    return this.elapsed < WebStrand.EXTEND + WebStrand.HOLD + WebStrand.FADE;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { EXTEND, HOLD, FADE } = WebStrand;

    // 뻗어 나가는 진행도 0~1
    const progress = Math.min(1, this.elapsed / EXTEND);
    // 사라지는 단계의 투명도
    const fadeStart = EXTEND + HOLD;
    const alpha =
      this.elapsed <= fadeStart
        ? 1
        : Math.max(0, 1 - (this.elapsed - fadeStart) / FADE);
    if (alpha <= 0) return;

    // 진행 방향의 수직 벡터 — 흔들림과 스플랫 방향에 씁니다.
    const perpX = -this.dirY;
    const perpY = this.dirX;
    const reach = this.length * progress;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // --- 굵은 중심 줄기 ---
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.lineWidth = this.thickness;
    this.tracePath(ctx, reach, perpX, perpY, 1);
    ctx.stroke();

    // --- 얇은 곁가지 두 줄 (꼬인 밧줄 느낌) ---
    ctx.strokeStyle = 'rgba(220, 235, 255, 0.55)';
    ctx.lineWidth = Math.max(1, this.thickness * 0.35);
    this.tracePath(ctx, reach, perpX, perpY, 2.2);
    ctx.stroke();
    this.tracePath(ctx, reach, perpX, perpY, -2.2);
    ctx.stroke();

    // --- 끝에 도달했으면 스플랫(붙은 자국)을 그립니다 ---
    if (progress >= 1) {
      const tipX = this.originX + this.dirX * this.length;
      const tipY = this.originY + this.dirY * this.length;
      const r = this.thickness * 2.2;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath();
      ctx.arc(tipX, tipY, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.lineWidth = Math.max(1, this.thickness * 0.5);
      for (const spoke of this.splatSpokes) {
        const len = r * 2.4 * spoke.len;
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(
          tipX + Math.cos(spoke.angle) * len,
          tipY + Math.sin(spoke.angle) * len,
        );
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  /**
   * 줄기 경로를 만듭니다.
   * @param offsetScale 흔들림을 몇 배로 적용할지 (곁가지를 벌리는 데 사용)
   */
  private tracePath(
    ctx: CanvasRenderingContext2D,
    reach: number,
    perpX: number,
    perpY: number,
    offsetScale: number,
  ): void {
    const segs = WebStrand.SEGMENTS;
    ctx.beginPath();
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const off = this.wobble[i] * offsetScale;
      const x = this.originX + this.dirX * reach * t + perpX * off;
      const y = this.originY + this.dirY * reach * t + perpY * off;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  }
}

/** 두 점 사이의 단위 방향 벡터. */
function directionBetween(from: Point2D, to: Point2D): { x: number; y: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const mag = Math.hypot(dx, dy) || 1e-6;
  return { x: dx / mag, y: dy / mag };
}

export const webShooterEffect: EffectDefinition = {
  id: 'web',
  label: '거미줄 발사',
  shape: { fingers: { thumb: true, index: true, middle: false, ring: false, pinky: true } },
  hint: '엄지·검지·새끼를 펴고 중지·약지는 접기',

  create() {
    return {
      onEnter(ctx: EffectContext) {
        const { points, handScale, width, height, engine, sound } = ctx;
        const wrist = points[LM.WRIST];
        const middleMcp = points[LM.MIDDLE_MCP];

        // 발사 방향 = 손목에서 손바닥을 지나 뻗는 방향.
        const dir = directionBetween(wrist, middleMcp);

        // 화면 밖까지 충분히 닿도록 대각선 길이만큼 뻗습니다.
        const length = Math.hypot(width, height) * 0.85;
        const thickness = Math.max(3, handScale * 0.09);

        engine.addEntity(
          new WebStrand(wrist.x, wrist.y, dir.x, dir.y, length, thickness),
        );

        // 발사 반동처럼 손목에서 하얀 입자가 튑니다.
        for (let i = 0; i < 14; i++) {
          const spread = rand(-0.35, 0.35);
          const cos = Math.cos(spread);
          const sin = Math.sin(spread);
          // 방향 벡터를 spread 각도만큼 회전시킵니다.
          const vx = (dir.x * cos - dir.y * sin) * rand(300, 900);
          const vy = (dir.x * sin + dir.y * cos) * rand(300, 900);
          engine.spawn({
            x: wrist.x,
            y: wrist.y,
            vx,
            vy,
            life: rand(0.15, 0.4),
            size: rand(2, 4),
            sizeEnd: 0,
            hue: 210,
            sat: 20,
            light: 95,
            drag: 0.15,
            shape: 'spark',
            additive: false,
          });
        }

        sound.webShot();
      },
    };
  },
};
