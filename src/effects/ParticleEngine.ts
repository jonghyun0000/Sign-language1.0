// =============================================================================
// ParticleEngine — 이펙트를 그리는 작은 2D 파티클 엔진
// =============================================================================
// 개념 정리 (초보자용):
//   * "파티클"은 불꽃 하나, 반짝임 하나처럼 아주 단순한 점입니다. 수백 개를
//     동시에 움직이면 불길이나 폭발처럼 보입니다.
//   * 각 파티클은 위치(x, y), 속도(vx, vy), 가속도(ax, ay), 남은 수명(life)을
//     가집니다. 매 프레임 "속도만큼 이동하고 수명을 깎는" 계산을 반복합니다.
//   * "엔티티(Entity)"는 파티클로 표현하기 어려운 것(거미줄 줄기처럼 선으로
//     이어진 것)을 위해, 스스로 update/draw를 하는 객체입니다.
//
// 성능 메모:
//   파티클 수에 상한(MAX_PARTICLES)을 두고, 죽은 파티클은 배열 마지막 요소와
//   자리를 바꿔 잘라냅니다(swap-remove). splice보다 훨씬 빠릅니다.

/** 파티클 모양. */
export type ParticleShape = 'circle' | 'spark' | 'heart' | 'ring' | 'square';

export interface Particle {
  x: number;
  y: number;
  /** 초당 픽셀 속도. */
  vx: number;
  vy: number;
  /** 초당 픽셀² 가속도 (중력, 상승기류 등). */
  ax: number;
  ay: number;
  /** 남은 수명(초). */
  life: number;
  /** 최초 수명(초) — 진행도 계산에 사용. */
  maxLife: number;
  /** 시작 / 끝 크기(px). 수명에 따라 선형 보간됩니다. */
  size: number;
  sizeEnd: number;
  /** HSL 색상. */
  hue: number;
  sat: number;
  light: number;
  /** 시작 / 끝 투명도. */
  alphaStart: number;
  alphaEnd: number;
  /** 속도 감쇠 계수 (1 = 감쇠 없음, 0.9 = 매 초 10% 감속). */
  drag: number;
  shape: ParticleShape;
  rotation: number;
  /** 초당 회전(라디안). */
  spin: number;
  /** true면 加算(additive) 합성 — 빛나는 느낌. */
  additive: boolean;
}

/** 파티클을 만들 때 넘기는 값 (지정하지 않은 항목은 기본값). */
export type ParticleOptions = Partial<Particle> & { x: number; y: number };

/** 스스로 갱신/렌더링하는 객체. update가 false를 반환하면 제거됩니다. */
export interface Entity {
  update(dt: number): boolean;
  draw(ctx: CanvasRenderingContext2D): void;
  /** true면 加算 합성으로 그립니다. */
  additive?: boolean;
}

/** 동시에 살아 있을 수 있는 최대 파티클 수. */
const MAX_PARTICLES = 1400;

export class ParticleEngine {
  private particles: Particle[] = [];
  private entities: Entity[] = [];
  /**
   * 화면 전체를 덮는 오버레이 (섬광, 균열, 어둠 등).
   * 파티클보다 "나중에" 그려야 화면 전체를 덮을 수 있어서 따로 관리합니다.
   */
  private overlays: Entity[] = [];

  /** 현재 파티클 수 (디버그 표시용). */
  get particleCount(): number {
    return this.particles.length;
  }

  /** 현재 엔티티 + 오버레이 수. */
  get entityCount(): number {
    return this.entities.length + this.overlays.length;
  }

  /**
   * 다음에 덮어쓸 자리 (원형 버퍼용).
   * 상한에 도달했을 때 어느 파티클을 버릴지 순서대로 가리킵니다.
   */
  private overwriteCursor = 0;

  /** 파티클 하나를 만듭니다. */
  spawn(options: ParticleOptions): void {
    // 상한에 도달하면 가장 오래된 것을 덮어씁니다.
    //
    // ⚠️ 예전에는 여기서 `shift()`를 썼습니다. shift()는 배열 전체를 한 칸씩
    // 당기는 O(n) 연산입니다. 불바다처럼 초당 수백 개를 만드는 이펙트에서는
    // 상한(1400개)에 계속 부딪히므로 초당 수십만~수백만 번의 원소 이동이
    // 일어나 프레임이 떨어졌습니다. 이제는 원형 버퍼로 O(1)에 덮어씁니다.
    if (this.particles.length >= MAX_PARTICLES) {
      this.overwriteCursor = (this.overwriteCursor + 1) % MAX_PARTICLES;
      this.writeParticle(this.particles[this.overwriteCursor], options);
      return;
    }
    const particle = {} as Particle;
    this.writeParticle(particle, options);
    this.particles.push(particle);
  }

  /**
   * 파티클 객체에 값을 채웁니다.
   * 새로 만들 때와 덮어쓸 때 같은 코드를 씁니다. 덮어쓰기는 새 객체를
   * 만들지 않으므로 가비지 컬렉션 부담도 줄어듭니다.
   */
  private writeParticle(p: Particle, options: ParticleOptions): void {
    const life = options.life ?? 1;
    p.x = options.x;
    p.y = options.y;
    p.vx = options.vx ?? 0;
    p.vy = options.vy ?? 0;
    p.ax = options.ax ?? 0;
    p.ay = options.ay ?? 0;
    p.life = life;
    p.maxLife = options.maxLife ?? life;
    p.size = options.size ?? 6;
    p.sizeEnd = options.sizeEnd ?? 0;
    p.hue = options.hue ?? 30;
    p.sat = options.sat ?? 100;
    p.light = options.light ?? 60;
    p.alphaStart = options.alphaStart ?? 1;
    p.alphaEnd = options.alphaEnd ?? 0;
    p.drag = options.drag ?? 1;
    p.shape = options.shape ?? 'circle';
    p.rotation = options.rotation ?? 0;
    p.spin = options.spin ?? 0;
    p.additive = options.additive ?? true;
  }

  /** 커스텀 엔티티를 추가합니다 (거미줄 줄기 등). */
  addEntity(entity: Entity): void {
    this.entities.push(entity);
  }

  /**
   * 화면 전체 오버레이를 추가합니다 (섬광, 균열 등).
   * 다른 모든 것 위에 그려집니다.
   */
  addOverlay(entity: Entity): void {
    this.overlays.push(entity);
  }

  /**
   * 물리 갱신.
   * @param dt 이전 프레임과의 시간 간격(초)
   */
  update(dt: number): void {
    // --- 파티클 ---
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        // swap-remove: 마지막 요소를 이 자리로 옮기고 길이를 줄입니다.
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
        continue;
      }
      // 속도에 가속도를 더하고, 감쇠를 적용한 뒤 위치를 옮깁니다.
      p.vx = (p.vx + p.ax * dt) * Math.pow(p.drag, dt);
      p.vy = (p.vy + p.ay * dt) * Math.pow(p.drag, dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.spin * dt;
    }

    // --- 엔티티 ---
    for (let i = this.entities.length - 1; i >= 0; i--) {
      if (!this.entities[i].update(dt)) {
        this.entities[i] = this.entities[this.entities.length - 1];
        this.entities.pop();
      }
    }

    // --- 화면 전체 오버레이 ---
    for (let i = this.overlays.length - 1; i >= 0; i--) {
      if (!this.overlays[i].update(dt)) {
        this.overlays[i] = this.overlays[this.overlays.length - 1];
        this.overlays.pop();
      }
    }
  }

  /** 캔버스에 그립니다. */
  render(ctx: CanvasRenderingContext2D): void {
    // 일반 합성부터 그리고, 빛나는 것들을 나중에 加算으로 덮습니다.
    // 이렇게 두 번 나눠 그리면 blend mode 전환 횟수가 줄어 성능에 유리합니다.
    ctx.save();

    ctx.globalCompositeOperation = 'source-over';
    for (const e of this.entities) if (!e.additive) e.draw(ctx);
    for (const p of this.particles) if (!p.additive) this.drawParticle(ctx, p);

    ctx.globalCompositeOperation = 'lighter';
    for (const e of this.entities) if (e.additive) e.draw(ctx);
    for (const p of this.particles) if (p.additive) this.drawParticle(ctx, p);

    // 화면 전체 오버레이는 가장 마지막에 — 모든 것을 덮습니다.
    for (const o of this.overlays) {
      ctx.globalCompositeOperation = o.additive ? 'lighter' : 'source-over';
      o.draw(ctx);
    }

    ctx.restore();
  }

  /** 파티클 하나를 모양에 맞게 그립니다. */
  private drawParticle(ctx: CanvasRenderingContext2D, p: Particle): void {
    // 진행도 0(갓 태어남) → 1(소멸 직전)
    const t = 1 - p.life / p.maxLife;
    const alpha = p.alphaStart + (p.alphaEnd - p.alphaStart) * t;
    if (alpha <= 0.01) return;
    const size = p.size + (p.sizeEnd - p.size) * t;
    if (size <= 0.1) return;

    ctx.globalAlpha = alpha;
    const color = `hsl(${p.hue}, ${p.sat}%, ${p.light}%)`;

    switch (p.shape) {
      case 'spark': {
        // 진행 방향으로 늘어난 선 — 빠른 불똥에 잘 어울립니다.
        const speed = Math.hypot(p.vx, p.vy);
        const len = Math.min(28, speed * 0.035 + size);
        const nx = speed > 0 ? p.vx / speed : 0;
        const ny = speed > 0 ? p.vy / speed : 0;
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, size * 0.5);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - nx * len, p.y - ny * len);
        ctx.stroke();
        break;
      }
      case 'ring': {
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, size * 0.18);
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'heart': {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = color;
        drawHeartPath(ctx, size);
        ctx.fill();
        ctx.restore();
        break;
      }
      case 'square': {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = color;
        ctx.fillRect(-size / 2, -size / 2, size, size);
        ctx.restore();
        break;
      }
      case 'circle':
      default: {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
    ctx.globalAlpha = 1;
  }

  /** 모든 파티클과 엔티티를 제거합니다 (모드 전환/초기화 시). */
  clear(): void {
    this.particles.length = 0;
    this.overwriteCursor = 0;
    this.entities.length = 0;
    this.overlays.length = 0;
  }
}

/**
 * 하트 모양 경로를 그립니다 (원점 중심, 대략 size 크기).
 * 베지에 곡선 두 개로 좌우 곡선을 만들고 아래에서 만나게 합니다.
 */
export function drawHeartPath(
  ctx: CanvasRenderingContext2D,
  size: number,
): void {
  const s = size / 16; // 아래 좌표는 16px 기준으로 잡았습니다.
  ctx.beginPath();
  ctx.moveTo(0, 5 * s);
  ctx.bezierCurveTo(-10 * s, -5 * s, -16 * s, 6 * s, 0, 16 * s);
  ctx.bezierCurveTo(16 * s, 6 * s, 10 * s, -5 * s, 0, 5 * s);
  ctx.closePath();
}

// -----------------------------------------------------------------------------
// 난수 헬퍼 — 이펙트마다 반복해서 쓰이므로 여기 모아둡니다.
// -----------------------------------------------------------------------------

/** min 이상 max 미만의 실수. */
export function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** ±spread 범위의 실수. */
export function randSpread(spread: number): number {
  return (Math.random() * 2 - 1) * spread;
}

/** 배열에서 무작위 요소 하나. */
export function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}
