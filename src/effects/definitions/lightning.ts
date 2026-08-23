// =============================================================================
// ⚡ 번개 (브이 사인)
// =============================================================================
// 손 모양: 검지 + 중지를 V자로 펴기
//
// 구현 아이디어:
//   두 손끝 사이와 손끝 바깥으로 지그재그 선(번개)을 짧게 번쩍이게 합니다.
//   번개는 "한 프레임만 보이고 사라지는" 성격이라 파티클보다 엔티티가
//   적합합니다. 수명이 아주 짧은(0.06~0.12초) 엔티티를 계속 새로 만듭니다.

import { LM } from '../../utils/landmarkUtils';
import type { Entity } from '../ParticleEngine';
import { rand, randSpread } from '../ParticleEngine';
import type { EffectContext, EffectDefinition } from '../types';

/** 지그재그 번개 한 줄기. */
class Bolt implements Entity {
  additive = true;

  private elapsed = 0;
  private readonly duration: number;
  /** 미리 계산해 둔 꺾인 점들 — 매 프레임 새로 뽑으면 형태가 튑니다. */
  private readonly path: Array<{ x: number; y: number }> = [];

  constructor(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    private readonly hue: number,
    private readonly thickness: number,
  ) {
    this.duration = rand(0.06, 0.14);

    // 시작점과 끝점을 잇는 선을 여러 마디로 나누고, 각 마디를 수직 방향으로
    // 무작위로 밀어 지그재그를 만듭니다.
    const segments = 9;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1e-6;
    const perpX = -dy / len;
    const perpY = dx / len;
    // 번개가 튀는 폭은 전체 길이에 비례시킵니다.
    const jitter = len * 0.16;

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      // 양 끝은 정확히 붙어야 하므로 흔들림을 0으로 수렴시킵니다.
      const taper = Math.sin(t * Math.PI);
      const off = randSpread(jitter) * taper;
      this.path.push({
        x: x1 + dx * t + perpX * off,
        y: y1 + dy * t + perpY * off,
      });
    }
  }

  update(dt: number): boolean {
    this.elapsed += dt;
    return this.elapsed < this.duration;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    // 번쩍이고 사라지는 느낌 — 수명 후반부에 급격히 어두워집니다.
    const t = this.elapsed / this.duration;
    const alpha = Math.max(0, 1 - t * t);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 바깥쪽 넓은 광채 → 안쪽 밝은 심지 순으로 두 번 그리면 빛나 보입니다.
    const passes: Array<[number, string]> = [
      [this.thickness * 3.2, `hsla(${this.hue}, 100%, 55%, 0.35)`],
      [this.thickness, `hsla(${this.hue}, 100%, 92%, 0.95)`],
    ];

    for (const [width, color] of passes) {
      ctx.lineWidth = width;
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

/** 초당 생성할 번개 줄기 수. */
const BOLTS_PER_SECOND = 22;

export const lightningEffect: EffectDefinition = {
  id: 'lightning',
  label: '번개',
  shape: { fingers: { thumb: false, index: true, middle: true, ring: false, pinky: false }, spread: 'wide' },
  hint: '검지와 중지를 V자로 펴기',

  create() {
    let carry = 0;
    // 소리가 너무 자주 나지 않도록 최소 간격을 둡니다.
    let soundCooldown = 0;

    return {
      onHold(ctx: EffectContext) {
        const { points, handScale, engine, sound, dt } = ctx;
        const indexTip = points[LM.INDEX_TIP];
        const middleTip = points[LM.MIDDLE_TIP];

        carry += BOLTS_PER_SECOND * dt;
        const count = Math.floor(carry);
        carry -= count;

        for (let i = 0; i < count; i++) {
          // 절반은 두 손끝을 잇는 아크, 절반은 바깥으로 뻗는 번개.
          if (Math.random() < 0.5) {
            engine.addEntity(
              new Bolt(
                indexTip.x,
                indexTip.y,
                middleTip.x,
                middleTip.y,
                rand(185, 205), // 청록~파랑
                Math.max(1.5, handScale * 0.03),
              ),
            );
          } else {
            // 손끝 하나에서 무작위 방향으로 뻗어 나가는 번개.
            const from = Math.random() < 0.5 ? indexTip : middleTip;
            const angle = rand(0, Math.PI * 2);
            const dist = handScale * rand(1.2, 3.0);
            engine.addEntity(
              new Bolt(
                from.x,
                from.y,
                from.x + Math.cos(angle) * dist,
                from.y + Math.sin(angle) * dist,
                rand(190, 260), // 파랑~보라
                Math.max(1.2, handScale * 0.022),
              ),
            );
          }
        }

        // 손끝에서 튀는 작은 전기 불똥.
        if (Math.random() < dt * 45) {
          const from = Math.random() < 0.5 ? indexTip : middleTip;
          engine.spawn({
            x: from.x,
            y: from.y,
            vx: randSpread(400),
            vy: randSpread(400),
            ay: 500,
            life: rand(0.15, 0.4),
            size: rand(2, 4),
            sizeEnd: 0,
            hue: rand(185, 220),
            sat: 100,
            light: 85,
            drag: 0.4,
            shape: 'spark',
            additive: true,
          });
        }

        soundCooldown -= dt;
        if (soundCooldown <= 0) {
          sound.zap();
          soundCooldown = rand(0.12, 0.3);
        }
      },
    };
  },
};
