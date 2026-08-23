// =============================================================================
// 화면 전체 필살기 (양손 이펙트)
// =============================================================================
// 규칙은 아주 단순합니다.
//
//   같은 손 모양을 "양손으로" 만들면 화면 전체 이펙트로 승급됩니다.
//
//   양손 거미줄  → 화면 전체가 거미줄로 봉인됨
//   양손 손바닥  → 화면 아래에서 불바다가 솟구침
//   양손 브이    → 화면 전체에 번개 폭풍
//   양손 검지    → 화면 전체에 별가루 폭풍
//   양손 주먹    → 화면이 갈라지고 진동
//
// 한 손 이펙트는 손 주변 좌표를 쓰지만, 여기 있는 이펙트들은 화면 크기
// (ctx.width, ctx.height)를 기준으로 좌표를 계산합니다.

import { rand, randSpread, type Entity } from '../ParticleEngine';
import { ScreenCrack, ScreenFlash, ScreenVignette } from '../ScreenEffects';
import type { EffectContext, EffectDefinition } from '../types';

// -----------------------------------------------------------------------------
// 화면 전체 거미줄 봉인
// -----------------------------------------------------------------------------

/** 화면 네 모서리에서 중앙으로 뻗어 화면을 덮는 거미줄. */
class WebNet implements Entity {
  additive = false;

  private elapsed = 0;
  private static readonly GROW = 0.45;
  private static readonly HOLD = 2.2;
  private static readonly FADE = 0.8;

  /** 방사형 줄기 각도들. */
  private readonly spokes: number[];
  /** 줄기를 잇는 나선 마디의 반지름 비율. */
  private readonly rings: number[];
  private readonly cx: number;
  private readonly cy: number;
  private readonly radius: number;

  constructor(width: number, height: number) {
    this.cx = width / 2;
    this.cy = height / 2;
    // 모서리까지 확실히 덮도록 대각선 절반보다 넉넉하게.
    this.radius = Math.hypot(width, height) * 0.62;

    const spokeCount = 12;
    this.spokes = Array.from(
      { length: spokeCount },
      (_, i) => (i / spokeCount) * Math.PI * 2 + randSpread(0.08),
    );
    // 안쪽은 촘촘하고 바깥은 성기게 — 실제 거미줄과 같은 느낌.
    this.rings = [0.18, 0.32, 0.48, 0.66, 0.85, 1.0].map(
      (r) => r * rand(0.94, 1.06),
    );
  }

  update(dt: number): boolean {
    this.elapsed += dt;
    return this.elapsed < WebNet.GROW + WebNet.HOLD + WebNet.FADE;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { GROW, HOLD, FADE } = WebNet;
    const progress = Math.min(1, this.elapsed / GROW);
    const fadeStart = GROW + HOLD;
    const alpha =
      this.elapsed <= fadeStart
        ? 0.9
        : Math.max(0, 0.9 * (1 - (this.elapsed - fadeStart) / FADE));
    if (alpha <= 0) return;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = 'rgba(240, 248, 255, 0.85)';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const reach = this.radius * progress;

    // --- 방사형 줄기 ---
    ctx.lineWidth = 3;
    for (const angle of this.spokes) {
      ctx.beginPath();
      ctx.moveTo(this.cx, this.cy);
      ctx.lineTo(
        this.cx + Math.cos(angle) * reach,
        this.cy + Math.sin(angle) * reach,
      );
      ctx.stroke();
    }

    // --- 줄기를 잇는 나선 (곡선으로 이어 늘어진 느낌) ---
    ctx.lineWidth = 2;
    for (const ringRatio of this.rings) {
      const r = this.radius * ringRatio;
      if (r > reach) continue; // 아직 그만큼 뻗지 않았으면 건너뜁니다.

      ctx.beginPath();
      for (let i = 0; i <= this.spokes.length; i++) {
        const a1 = this.spokes[i % this.spokes.length];
        const x = this.cx + Math.cos(a1) * r;
        const y = this.cy + Math.sin(a1) * r;
        if (i === 0) {
          ctx.moveTo(x, y);
          continue;
        }
        // 줄기 사이를 안쪽으로 살짝 늘어뜨려 거미줄처럼 만듭니다.
        const a0 = this.spokes[(i - 1) % this.spokes.length];
        const mid = (a0 + a1) / 2;
        const sag = r * 0.86;
        ctx.quadraticCurveTo(
          this.cx + Math.cos(mid) * sag,
          this.cy + Math.sin(mid) * sag,
          x,
          y,
        );
      }
      ctx.stroke();
    }

    ctx.restore();
  }
}

export const webPrisonEffect: EffectDefinition = {
  id: 'webPrison',
  label: '거미줄 봉인',
  screenWide: true,
  shape: {
    fingers: { thumb: true, index: true, middle: false, ring: false, pinky: true },
    hands: 2,
  },
  hint: '양손 모두 거미줄 손 모양 (엄지·검지·새끼 펴기)',

  create() {
    return {
      onEnter(ctx: EffectContext) {
        const { engine, sound, shaker, width, height } = ctx;

        engine.addOverlay(new WebNet(width, height));
        // 거미줄이 화면에 꽂히는 충격.
        shaker.shake(9, 0.4);
        sound.webShot();

        // 중앙에서 사방으로 튀는 거미줄 조각.
        for (let i = 0; i < 60; i++) {
          const angle = rand(0, Math.PI * 2);
          const speed = rand(300, 1100);
          engine.spawn({
            x: width / 2,
            y: height / 2,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: rand(0.3, 0.7),
            size: rand(2, 5),
            sizeEnd: 0,
            hue: 210,
            sat: 15,
            light: 95,
            drag: 0.2,
            shape: 'spark',
            additive: false,
          });
        }
      },
    };
  },
};

// -----------------------------------------------------------------------------
// 불바다 (화면 아래 전체에서 불길)
// -----------------------------------------------------------------------------

export const infernoEffect: EffectDefinition = {
  id: 'inferno',
  label: '불바다',
  screenWide: true,
  shape: {
    fingers: { thumb: true, index: true, middle: true, ring: true, pinky: true },
    hands: 2,
  },
  hint: '양손 모두 다섯 손가락 펴기',

  create() {
    let carry = 0;
    let smokeCarry = 0;
    let vignette: ScreenVignette | null = null;

    return {
      onEnter(ctx: EffectContext) {
        const { engine, sound, shaker, width, height } = ctx;
        // 화면 테두리가 붉게 달아오릅니다.
        vignette = new ScreenVignette(width, height, 18, 0.42, 0.6);
        engine.addOverlay(vignette);
        // 낮은 진동이 계속 이어집니다.
        shaker.shake(5, 1.2);
        sound.startFire();
      },

      onHold(ctx: EffectContext) {
        const { engine, shaker, width, height, dt } = ctx;

        // 비네트와 진동을 유지합니다.
        vignette?.keepAlive(0.5);
        shaker.shake(4, 0.8);

        // 화면 폭에 비례해 불꽃 양을 정합니다(넓은 화면일수록 더 많이).
        const perSecond = 900 * (width / 1280);

        carry += perSecond * dt;
        const count = Math.floor(carry);
        carry -= count;

        for (let i = 0; i < count; i++) {
          const x = rand(-40, width + 40);
          // 불길 세기를 위치마다 다르게 해서 일렁이는 느낌을 만듭니다.
          const power = rand(0.5, 1.4);
          engine.spawn({
            x,
            y: height + rand(0, 30),
            vx: randSpread(90),
            // 위로 솟구칩니다.
            vy: -rand(320, 780) * power,
            ay: -rand(150, 420),
            life: rand(0.6, 1.4),
            size: rand(10, 30) * power,
            sizeEnd: 0,
            hue: rand(14, 48),
            sat: 100,
            light: rand(52, 72),
            alphaStart: 0.9,
            alphaEnd: 0,
            drag: 0.45,
            shape: 'circle',
            additive: true,
          });
        }

        // 위쪽으로 흐르는 검은 연기.
        smokeCarry += 120 * (width / 1280) * dt;
        const smokeCount = Math.floor(smokeCarry);
        smokeCarry -= smokeCount;

        for (let i = 0; i < smokeCount; i++) {
          engine.spawn({
            x: rand(0, width),
            y: height * rand(0.55, 1),
            vx: randSpread(70),
            vy: -rand(120, 300),
            life: rand(1.2, 2.4),
            size: rand(30, 70),
            sizeEnd: rand(110, 190),
            hue: 22,
            sat: 10,
            light: 16,
            alphaStart: 0.22,
            alphaEnd: 0,
            drag: 0.6,
            shape: 'circle',
            additive: false,
          });
        }
      },

      onExit(ctx: EffectContext) {
        ctx.sound.stopLoop();
        vignette = null;
      },
    };
  },
};

// -----------------------------------------------------------------------------
// 번개 폭풍 (화면 전체)
// -----------------------------------------------------------------------------

/** 화면을 가로지르는 큰 번개. 위에서 아래로 내리칩니다. */
class StormBolt implements Entity {
  additive = true;

  private elapsed = 0;
  private readonly duration = rand(0.08, 0.18);
  private readonly path: Array<{ x: number; y: number }> = [];
  private readonly thickness: number;

  constructor(startX: number, width: number, height: number) {
    this.thickness = rand(2, 5);
    const segments = 14;
    let x = startX;

    for (let i = 0; i <= segments; i++) {
      const y = (height / segments) * i;
      this.path.push({ x, y });
      // 아래로 내려오면서 좌우로 지그재그.
      x += randSpread(width * 0.06);
    }
  }

  update(dt: number): boolean {
    this.elapsed += dt;
    return this.elapsed < this.duration;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const t = this.elapsed / this.duration;
    const alpha = Math.max(0, 1 - t * t);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const passes: Array<[number, string]> = [
      [this.thickness * 4, 'hsla(210, 100%, 60%, 0.3)'],
      [this.thickness, 'hsla(200, 100%, 95%, 0.95)'],
    ];
    for (const [lineWidth, color] of passes) {
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = color;
      ctx.beginPath();
      this.path.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
    }
    ctx.restore();
  }
}

export const thunderstormEffect: EffectDefinition = {
  id: 'thunderstorm',
  label: '번개 폭풍',
  screenWide: true,
  shape: {
    fingers: { thumb: false, index: true, middle: true, ring: false, pinky: false },
    spread: 'wide',
    hands: 2,
  },
  hint: '양손 모두 브이(V) 사인',

  create() {
    let boltCooldown = 0;
    let vignette: ScreenVignette | null = null;

    return {
      onEnter(ctx: EffectContext) {
        const { engine, width, height } = ctx;
        // 폭풍우처럼 화면 가장자리를 어둡고 푸르게.
        vignette = new ScreenVignette(width, height, 225, 0.4, 0.6);
        engine.addOverlay(vignette);
      },

      onHold(ctx: EffectContext) {
        const { engine, sound, shaker, width, height, dt } = ctx;
        vignette?.keepAlive(0.5);

        boltCooldown -= dt;
        if (boltCooldown > 0) return;
        boltCooldown = rand(0.1, 0.28);

        // 한 번에 1~3줄기가 동시에 내리칩니다.
        const strikes = Math.round(rand(1, 3));
        for (let i = 0; i < strikes; i++) {
          engine.addEntity(new StormBolt(rand(0, width), width, height));
        }

        // 번개가 칠 때마다 화면이 번쩍이고 흔들립니다.
        engine.addOverlay(new ScreenFlash(width, height, 205, rand(0.12, 0.3), 0.18));
        shaker.shake(rand(4, 10), 0.35);
        sound.zap();

        // 땅에 떨어진 지점에서 튀는 불똥.
        for (let i = 0; i < 18; i++) {
          const angle = rand(-Math.PI, 0); // 위쪽으로 튀도록
          const speed = rand(200, 700);
          engine.spawn({
            x: rand(0, width),
            y: height,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            ay: 900,
            life: rand(0.3, 0.7),
            size: rand(2, 4),
            sizeEnd: 0,
            hue: rand(195, 225),
            sat: 100,
            light: 88,
            drag: 0.5,
            shape: 'spark',
            additive: true,
          });
        }
      },

      onExit() {
        vignette = null;
      },
    };
  },
};

// -----------------------------------------------------------------------------
// 별가루 폭풍 (화면 전체)
// -----------------------------------------------------------------------------

export const starstormEffect: EffectDefinition = {
  id: 'starstorm',
  label: '별가루 폭풍',
  screenWide: true,
  shape: {
    fingers: { thumb: false, index: true, middle: false, ring: false, pinky: false },
    direction: 'up',
    hands: 2,
  },
  hint: '양손 모두 검지만 펴기',

  create() {
    let carry = 0;
    let hue = rand(0, 360);
    let soundCooldown = 0;

    return {
      onHold(ctx: EffectContext) {
        // 별가루는 화면 위에서 떨어지므로 height 는 쓰지 않습니다.
        const { engine, sound, width, dt } = ctx;

        // 무지개색이 천천히 순환합니다.
        hue = (hue + dt * 70) % 360;

        const perSecond = 320 * (width / 1280);
        carry += perSecond * dt;
        const count = Math.floor(carry);
        carry -= count;

        for (let i = 0; i < count; i++) {
          // 화면 위쪽에서 눈처럼 흩날려 내려옵니다.
          engine.spawn({
            x: rand(-30, width + 30),
            y: rand(-60, -10),
            vx: randSpread(120),
            vy: rand(80, 260),
            ax: randSpread(60),
            life: rand(2.0, 4.0),
            size: rand(2, 7),
            sizeEnd: 0,
            hue: (hue + randSpread(60) + 360) % 360,
            sat: 95,
            light: 75,
            alphaStart: 0.95,
            alphaEnd: 0,
            drag: 0.9,
            shape: 'circle',
            additive: true,
          });
        }

        // 가끔 큰 별이 회전하며 떨어집니다.
        if (Math.random() < dt * 14) {
          engine.spawn({
            x: rand(0, width),
            y: -20,
            vx: randSpread(90),
            vy: rand(120, 280),
            life: rand(2.5, 4.0),
            size: rand(10, 18),
            sizeEnd: 0,
            hue: (hue + 180) % 360,
            sat: 100,
            light: 85,
            drag: 0.9,
            shape: 'square',
            rotation: rand(0, Math.PI),
            spin: randSpread(4),
            additive: true,
          });
        }

        soundCooldown -= dt;
        if (soundCooldown <= 0) {
          sound.sparkle();
          soundCooldown = rand(0.18, 0.45);
        }
      },
    };
  },
};

// -----------------------------------------------------------------------------
// 화면 균열 + 지진 (양손 주먹)
// -----------------------------------------------------------------------------

export const quakeEffect: EffectDefinition = {
  id: 'quake',
  label: '화면 균열',
  screenWide: true,
  shape: {
    fingers: { thumb: false, index: false, middle: false, ring: false, pinky: false },
    hands: 2,
  },
  hint: '양손 모두 주먹 — 오래 쥘수록 강해집니다',

  create() {
    // 에너지 이펙트처럼 "모았다가 터뜨리는" 구조입니다.
    let charge = 0;
    const MAX_CHARGE = 2.0;

    return {
      onEnter(ctx: EffectContext) {
        charge = 0;
        ctx.sound.startCharge();
      },

      onHold(ctx: EffectContext) {
        const { engine, shaker, width, height, dt } = ctx;
        charge = Math.min(1, charge + dt / MAX_CHARGE);

        // 충전이 찰수록 화면이 점점 더 심하게 떨립니다.
        shaker.shake(charge * 7, 0.3);

        // 화면 가장자리에서 중앙으로 에너지가 빨려듭니다.
        if (Math.random() < dt * (40 + charge * 120)) {
          const angle = rand(0, Math.PI * 2);
          const dist = Math.hypot(width, height) * 0.5;
          const cx = width / 2;
          const cy = height / 2;
          const speed = dist / rand(0.4, 0.8);
          engine.spawn({
            x: cx + Math.cos(angle) * dist,
            y: cy + Math.sin(angle) * dist,
            vx: -Math.cos(angle) * speed,
            vy: -Math.sin(angle) * speed,
            life: rand(0.4, 0.8),
            size: rand(3, 7),
            sizeEnd: 0,
            hue: 200 + charge * 60,
            sat: 100,
            light: 78,
            drag: 1,
            shape: 'spark',
            additive: true,
          });
        }
      },

      onExit(ctx: EffectContext) {
        const { engine, sound, shaker, width, height } = ctx;
        sound.stopLoop();

        // 충전이 거의 없으면 조용히 끝냅니다(오발 방지).
        if (charge < 0.2) {
          charge = 0;
          return;
        }

        const power = charge;
        const cx = width / 2;
        const cy = height / 2;

        // --- 화면 균열 ---
        engine.addOverlay(
          new ScreenCrack(cx, cy, width, height, Math.round(6 + power * 8)),
        );
        // --- 흰 섬광 ---
        engine.addOverlay(new ScreenFlash(width, height, 210, 0.5 * power, 0.3));
        // --- 격렬한 진동 ---
        shaker.shake(14 + power * 26, 0.9);

        // --- 사방으로 퍼지는 충격파 링 ---
        for (let i = 0; i < 4; i++) {
          engine.spawn({
            x: cx,
            y: cy,
            life: 0.6 + power * 0.5,
            size: 20,
            sizeEnd: Math.hypot(width, height) * (0.6 + power * 0.5) + i * 60,
            hue: 205,
            sat: 90,
            light: 80,
            alphaStart: 0.75 - i * 0.15,
            alphaEnd: 0,
            shape: 'ring',
            additive: true,
          });
        }

        // --- 부서진 파편 ---
        const shards = Math.round(90 + power * 160);
        for (let i = 0; i < shards; i++) {
          const angle = rand(0, Math.PI * 2);
          const speed = rand(250, 1600) * power;
          engine.spawn({
            x: cx + randSpread(40),
            y: cy + randSpread(40),
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            ay: 900,
            life: rand(0.5, 1.4),
            size: rand(3, 9),
            sizeEnd: 0,
            hue: rand(195, 225),
            sat: 60,
            light: rand(70, 95),
            drag: 0.3,
            shape: 'square',
            rotation: rand(0, Math.PI),
            spin: randSpread(10),
            additive: true,
          });
        }

        sound.boom(0.8 + power * 1.2);
        charge = 0;
      },
    };
  },
};

/** 화면 전체 이펙트 모음 — EffectManager에서 한 번에 등록합니다. */
export const SCREEN_WIDE_EFFECTS: EffectDefinition[] = [
  webPrisonEffect,
  infernoEffect,
  thunderstormEffect,
  starstormEffect,
  quakeEffect,
];
