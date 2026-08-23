// =============================================================================
// ScreenEffects — 화면 전체에 적용되는 연출 도구
// =============================================================================
// 손 주변에서만 일어나던 이펙트와 달리, 여기 있는 것들은 화면 전체를 덮습니다.
//
//   flash()    — 순간적으로 화면 전체가 번쩍임
//   vignette() — 화면 가장자리가 어두워지거나 특정 색으로 물듦
//   crack()    — 화면이 유리처럼 깨짐
//   shake      — 화면 자체가 흔들림 (DOM transform으로 처리)
//
// 흔들림만 캔버스가 아니라 DOM을 움직이는 이유:
//   캔버스 안에서 좌표를 옮기면 파티클만 흔들리고 카메라 영상은 가만히 있어
//   어색합니다. 컨테이너 요소를 통째로 흔들어야 "화면이 흔들린다"는 느낌이 납니다.

import type { Entity } from './ParticleEngine';
import { rand, randSpread } from './ParticleEngine';

// -----------------------------------------------------------------------------
// 섬광 (Flash)
// -----------------------------------------------------------------------------

/** 화면 전체를 덮는 섬광. 빠르게 밝아졌다가 사라집니다. */
export class ScreenFlash implements Entity {
  additive = true;

  private elapsed = 0;

  constructor(
    private readonly width: number,
    private readonly height: number,
    private readonly hue: number,
    private readonly peak: number,
    private readonly duration: number,
  ) {}

  update(dt: number): boolean {
    this.elapsed += dt;
    return this.elapsed < this.duration;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const t = this.elapsed / this.duration;
    // 확 밝아졌다가(앞 15%) 천천히 사라집니다.
    const alpha =
      t < 0.15 ? (t / 0.15) * this.peak : this.peak * (1 - (t - 0.15) / 0.85);
    if (alpha <= 0) return;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = `hsl(${this.hue}, 100%, 75%)`;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.globalAlpha = 1;
  }
}

// -----------------------------------------------------------------------------
// 비네트 (Vignette) — 가장자리 물들이기
// -----------------------------------------------------------------------------

/**
 * 화면 가장자리를 특정 색으로 물들입니다.
 * 불바다에서 화면 테두리가 붉게 달아오르는 연출 등에 씁니다.
 */
export class ScreenVignette implements Entity {
  additive = false;

  private elapsed = 0;
  /** 외부에서 유지 시간을 늘릴 수 있게 열어 둡니다. */
  private ttl: number;

  constructor(
    private readonly width: number,
    private readonly height: number,
    private readonly hue: number,
    private readonly strength: number,
    duration: number,
  ) {
    this.ttl = duration;
  }

  /** 이펙트가 유지되는 동안 계속 살아 있도록 수명을 연장합니다. */
  keepAlive(seconds: number): void {
    this.ttl = Math.max(this.ttl, this.elapsed + seconds);
  }

  update(dt: number): boolean {
    this.elapsed += dt;
    return this.elapsed < this.ttl;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const remaining = this.ttl - this.elapsed;
    // 등장과 퇴장을 0.3초에 걸쳐 부드럽게 처리합니다.
    const fadeIn = Math.min(1, this.elapsed / 0.3);
    const fadeOut = Math.min(1, remaining / 0.3);
    const alpha = this.strength * fadeIn * fadeOut;
    if (alpha <= 0.01) return;

    const cx = this.width / 2;
    const cy = this.height / 2;
    const outer = Math.hypot(cx, cy);

    // 가운데는 투명하고 바깥으로 갈수록 색이 진해지는 방사형 그라디언트.
    const grad = ctx.createRadialGradient(cx, cy, outer * 0.35, cx, cy, outer);
    grad.addColorStop(0, `hsla(${this.hue}, 100%, 50%, 0)`);
    grad.addColorStop(1, `hsla(${this.hue}, 100%, 45%, ${alpha})`);

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);
  }
}

// -----------------------------------------------------------------------------
// 화면 균열 (Crack)
// -----------------------------------------------------------------------------

/**
 * 화면이 유리처럼 갈라지는 연출.
 * 충격 지점에서 사방으로 뻗은 주 균열과, 거기서 갈라지는 잔금을 그립니다.
 */
export class ScreenCrack implements Entity {
  additive = false;

  private elapsed = 0;
  /** 주 균열: 각각 꺾인 점들의 배열. */
  private readonly branches: Array<Array<{ x: number; y: number }>> = [];

  private static readonly GROW = 0.25;
  private static readonly HOLD = 1.6;
  private static readonly FADE = 0.9;

  constructor(
    originX: number,
    originY: number,
    width: number,
    height: number,
    /** 주 균열 개수. */
    branchCount = 9,
  ) {
    const maxReach = Math.hypot(width, height) * 0.75;

    for (let i = 0; i < branchCount; i++) {
      // 사방으로 고르게 퍼지되 약간의 무작위성을 줍니다.
      const angle = (i / branchCount) * Math.PI * 2 + randSpread(0.3);
      const reach = maxReach * rand(0.45, 1);
      const segments = 5;
      const points: Array<{ x: number; y: number }> = [
        { x: originX, y: originY },
      ];

      // 균열은 직선이 아니라 조금씩 꺾이며 뻗어 나갑니다.
      let currentAngle = angle;
      let x = originX;
      let y = originY;
      for (let s = 0; s < segments; s++) {
        currentAngle += randSpread(0.35);
        const step = reach / segments;
        x += Math.cos(currentAngle) * step;
        y += Math.sin(currentAngle) * step;
        points.push({ x, y });
      }
      this.branches.push(points);

      // 주 균열 중간에서 갈라지는 잔금을 하나씩 답니다.
      const forkFrom = points[Math.floor(segments / 2)];
      const forkAngle = currentAngle + randSpread(1.2);
      const forkLen = reach * rand(0.15, 0.35);
      this.branches.push([
        { x: forkFrom.x, y: forkFrom.y },
        {
          x: forkFrom.x + Math.cos(forkAngle) * forkLen,
          y: forkFrom.y + Math.sin(forkAngle) * forkLen,
        },
      ]);
    }
  }

  update(dt: number): boolean {
    this.elapsed += dt;
    return (
      this.elapsed < ScreenCrack.GROW + ScreenCrack.HOLD + ScreenCrack.FADE
    );
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { GROW, HOLD, FADE } = ScreenCrack;
    // 균열이 뻗어 나가는 진행도.
    const progress = Math.min(1, this.elapsed / GROW);
    const fadeStart = GROW + HOLD;
    const alpha =
      this.elapsed <= fadeStart
        ? 1
        : Math.max(0, 1 - (this.elapsed - fadeStart) / FADE);
    if (alpha <= 0) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const points of this.branches) {
      // 진행도에 따라 그릴 마디 수를 늘립니다.
      const drawCount = Math.max(2, Math.ceil(points.length * progress));

      // 어두운 틈 + 밝은 하이라이트를 겹쳐 그리면 유리처럼 보입니다.
      const passes: Array<[number, string]> = [
        [5, `rgba(10, 12, 20, ${0.75 * alpha})`],
        [1.6, `rgba(210, 235, 255, ${0.9 * alpha})`],
      ];

      for (const [lineWidth, color] of passes) {
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = color;
        ctx.beginPath();
        for (let i = 0; i < drawCount; i++) {
          const p = points[i];
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}

// -----------------------------------------------------------------------------
// 화면 흔들림 (Shake)
// -----------------------------------------------------------------------------

/**
 * 컨테이너 요소를 흔들어 "화면이 흔들리는" 느낌을 만듭니다.
 *
 * EffectManager가 매 프레임 update()를 호출하고, 결과 transform을 요소에
 * 적용합니다. 이펙트 코드는 shake()만 부르면 됩니다.
 */
export class ScreenShaker {
  private intensity = 0;
  private decay = 1;
  /** 흔들림을 적용할 DOM 요소. */
  private target: HTMLElement | null = null;

  attach(element: HTMLElement | null): void {
    // 요소가 바뀌면 이전 요소의 흔들림을 되돌립니다.
    if (this.target && this.target !== element) {
      this.target.style.transform = '';
    }
    this.target = element;
  }

  /**
   * 흔들림을 시작합니다.
   * @param intensity 최대 흔들림 폭(px)
   * @param duration  잦아드는 데 걸리는 시간(초)
   */
  shake(intensity: number, duration = 0.6): void {
    // 이미 흔들리는 중이면 더 센 쪽을 따릅니다.
    this.intensity = Math.max(this.intensity, intensity);
    this.decay = intensity / Math.max(0.05, duration);
  }

  /** 매 프레임 호출 — 흔들림을 줄이고 요소에 반영합니다. */
  update(dt: number): void {
    if (!this.target) return;

    if (this.intensity <= 0.01) {
      // 완전히 멈췄으면 transform을 지웁니다(불필요한 합성 레이어 제거).
      if (this.target.style.transform) this.target.style.transform = '';
      this.intensity = 0;
      return;
    }

    const dx = randSpread(this.intensity);
    const dy = randSpread(this.intensity);
    // 살짝 회전까지 섞으면 훨씬 격렬해 보입니다.
    const rot = randSpread(this.intensity * 0.06);
    this.target.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg)`;

    this.intensity = Math.max(0, this.intensity - this.decay * dt);
  }

  /** 즉시 멈추고 원래 위치로 되돌립니다. */
  reset(): void {
    this.intensity = 0;
    if (this.target) this.target.style.transform = '';
  }
}
