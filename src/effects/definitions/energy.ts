// =============================================================================
// ✊ 에너지 충전 → 충격파 (주먹)
// =============================================================================
// 손 모양: 주먹을 쥐고 있으면 충전, 손을 펴면 방출
//
// 이 이펙트는 세 단계를 모두 쓰는 좋은 예시입니다.
//   onEnter — 충전 시작 (소리 재생)
//   onHold  — 충전량이 쌓이며 에너지 구슬이 커지고 입자가 빨려 들어옴
//   onExit  — 쌓인 충전량에 비례해 충격파와 폭발 입자를 터뜨림
//
// "모았다가 터뜨린다"는 상호작용은 사용자가 화면을 계속 보게 만드는
// 아주 효과적인 장치입니다.

import { LM } from '../../utils/landmarkUtils';
import type { Entity } from '../ParticleEngine';
import { rand, randSpread } from '../ParticleEngine';
import type { EffectContext, EffectDefinition } from '../types';

/** 최대 충전 시간(초). 이 이상 들고 있어도 더 세지지 않습니다. */
const MAX_CHARGE_SECONDS = 2.2;

/** 충전 중 주먹 위에 떠 있는 에너지 구슬. */
class EnergyOrb implements Entity {
  additive = true;

  private alive = true;

  constructor(
    public x: number,
    public y: number,
    /** 0~1 충전 진행도. 외부에서 매 프레임 갱신합니다. */
    public charge: number,
    private readonly baseRadius: number,
  ) {}

  /** 위치와 충전량을 외부에서 갱신합니다. */
  sync(x: number, y: number, charge: number): void {
    this.x = x;
    this.y = y;
    this.charge = charge;
  }

  /** 방출 시 제거하도록 표시합니다. */
  kill(): void {
    this.alive = false;
  }

  update(): boolean {
    return this.alive;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const r = this.baseRadius * (0.3 + this.charge * 1.1);
    // 충전이 찰수록 파랑 → 보라 → 흰빛으로 뜨거워집니다.
    const hue = 200 + this.charge * 80;

    // 방사형 그라디언트로 가운데가 밝은 구슬을 만듭니다.
    const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r);
    grad.addColorStop(0, `hsla(${hue}, 100%, 95%, 0.95)`);
    grad.addColorStop(0.45, `hsla(${hue}, 100%, 65%, 0.55)`);
    grad.addColorStop(1, `hsla(${hue}, 100%, 50%, 0)`);

    ctx.save();
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.fill();

    // 충전이 거의 다 되면 경고하듯 테두리가 깜빡입니다.
    if (this.charge > 0.85) {
      ctx.strokeStyle = `hsla(${hue}, 100%, 90%, ${rand(0.3, 0.8)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, r * 1.15, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

export const energyEffect: EffectDefinition = {
  id: 'energy',
  label: '에너지 충격파',
  shape: { fingers: { thumb: false, index: false, middle: false, ring: false, pinky: false } },
  hint: '주먹을 쥐고 모았다가 손을 펴서 방출',

  create() {
    let charge = 0;
    let orb: EnergyOrb | null = null;

    return {
      onEnter(ctx: EffectContext) {
        charge = 0;
        const palm = ctx.points[LM.MIDDLE_MCP];
        orb = new EnergyOrb(palm.x, palm.y, 0, ctx.handScale * 0.9);
        ctx.engine.addEntity(orb);
        ctx.sound.startCharge();
      },

      onHold(ctx: EffectContext) {
        const { points, handScale, engine, dt } = ctx;
        const palm = points[LM.MIDDLE_MCP];

        charge = Math.min(1, charge + dt / MAX_CHARGE_SECONDS);
        orb?.sync(palm.x, palm.y, charge);

        // 주변에서 에너지가 빨려 들어오는 입자.
        // 충전이 진행될수록 더 많이, 더 빠르게 모입니다.
        const inflow = 30 + charge * 90;
        if (Math.random() < dt * inflow) {
          const angle = rand(0, Math.PI * 2);
          const dist = handScale * rand(2.0, 4.0);
          const startX = palm.x + Math.cos(angle) * dist;
          const startY = palm.y + Math.sin(angle) * dist;
          // 중심을 향하는 속도를 줍니다.
          const speed = dist / rand(0.25, 0.5);
          engine.spawn({
            x: startX,
            y: startY,
            vx: -Math.cos(angle) * speed,
            vy: -Math.sin(angle) * speed,
            life: rand(0.25, 0.5),
            size: rand(2, 5),
            sizeEnd: 0,
            hue: 200 + charge * 80,
            sat: 100,
            light: 75,
            drag: 1,
            shape: 'spark',
            additive: true,
          });
        }
      },

      onExit(ctx: EffectContext) {
        const { points, handScale, engine, sound } = ctx;
        const palm = points[LM.MIDDLE_MCP];

        orb?.kill();
        orb = null;
        sound.stopLoop();

        // 거의 충전하지 않았으면 조용히 끝냅니다(오발 방지).
        if (charge < 0.15) {
          charge = 0;
          return;
        }

        const power = charge; // 0.15 ~ 1
        const hue = 200 + power * 80;

        // --- 확장하는 충격파 링 ---
        for (let i = 0; i < 3; i++) {
          engine.spawn({
            x: palm.x,
            y: palm.y,
            life: 0.5 + power * 0.4,
            size: handScale * 0.4,
            sizeEnd: handScale * (4 + power * 8) + i * 40,
            hue,
            sat: 100,
            light: 75,
            alphaStart: 0.8 - i * 0.2,
            alphaEnd: 0,
            shape: 'ring',
            additive: true,
          });
        }

        // --- 사방으로 터지는 입자 ---
        const burstCount = Math.round(50 + power * 140);
        for (let i = 0; i < burstCount; i++) {
          const angle = rand(0, Math.PI * 2);
          const speed = rand(200, 1400) * power;
          engine.spawn({
            x: palm.x + randSpread(handScale * 0.2),
            y: palm.y + randSpread(handScale * 0.2),
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            ay: 700, // 중력에 끌려 내려옵니다
            life: rand(0.4, 1.2),
            size: rand(3, 8),
            sizeEnd: 0,
            hue: hue + randSpread(30),
            sat: 100,
            light: rand(65, 90),
            drag: 0.25,
            shape: 'spark',
            additive: true,
          });
        }

        sound.boom(0.6 + power);
        charge = 0;
      },
    };
  },
};
