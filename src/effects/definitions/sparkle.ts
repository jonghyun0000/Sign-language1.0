// =============================================================================
// ✨ 반짝임 트레일 (검지)
// =============================================================================
// 손 모양: 검지만 곧게 펴기 (가리키는 모양)
//
// 구현 아이디어:
//   손끝 위치에 작은 반짝임을 계속 뿌리면, 손을 움직일 때 궤적이 남아
//   "요술봉으로 그림을 그리는" 느낌이 납니다.
//   * 무지개색이 서서히 순환하도록 hue를 시간에 따라 증가시킵니다.
//   * 가끔 큰 별 하나를 섞으면 밋밋함이 사라집니다.

import { LM } from '../../utils/landmarkUtils';
import { rand, randSpread } from '../ParticleEngine';
import type { EffectContext, EffectDefinition } from '../types';

/** 초당 생성할 반짝임 수. */
const SPARKS_PER_SECOND = 90;

export const sparkleEffect: EffectDefinition = {
  id: 'sparkle',
  label: '반짝임 트레일',
  shape: { fingers: { thumb: false, index: true, middle: false, ring: false, pinky: false }, direction: 'up' },
  hint: '검지만 곧게 펴서 허공에 그리기',

  create() {
    let carry = 0;
    // 시간에 따라 색이 순환하도록 hue를 계속 돌립니다.
    let hue = rand(0, 360);
    let soundCooldown = 0;
    // 이전 프레임의 손끝 위치 — 빠르게 움직일 때 사이를 메우는 데 씁니다.
    let prev: { x: number; y: number } | null = null;

    return {
      onExit() {
        prev = null;
      },

      onHold(ctx: EffectContext) {
        const { points, handScale, engine, sound, dt } = ctx;
        const tip = points[LM.INDEX_TIP];

        hue = (hue + dt * 90) % 360;

        carry += SPARKS_PER_SECOND * dt;
        const count = Math.floor(carry);
        carry -= count;

        for (let i = 0; i < count; i++) {
          // 손을 빠르게 움직이면 프레임 사이가 뚝뚝 끊기므로, 이전 위치와
          // 현재 위치 사이를 보간해서 부드러운 선으로 만듭니다.
          const t = count > 1 ? i / count : 1;
          const x = prev ? prev.x + (tip.x - prev.x) * t : tip.x;
          const y = prev ? prev.y + (tip.y - prev.y) * t : tip.y;

          engine.spawn({
            x: x + randSpread(handScale * 0.06),
            y: y + randSpread(handScale * 0.06),
            vx: randSpread(60),
            vy: randSpread(60) - 30, // 살짝 위로 떠오르게
            life: rand(0.4, 1.1),
            size: rand(2, 5) * (handScale / 100),
            sizeEnd: 0,
            hue: (hue + randSpread(30) + 360) % 360,
            sat: 95,
            light: 70,
            alphaStart: 0.95,
            alphaEnd: 0,
            drag: 0.6,
            shape: 'circle',
            additive: true,
          });
        }

        // 가끔 큰 별을 하나 섞습니다.
        if (Math.random() < dt * 6) {
          engine.spawn({
            x: tip.x,
            y: tip.y,
            vx: randSpread(40),
            vy: randSpread(40),
            life: rand(0.5, 0.9),
            size: rand(8, 14) * (handScale / 100),
            sizeEnd: 0,
            hue: (hue + 180) % 360,
            sat: 100,
            light: 85,
            drag: 0.5,
            shape: 'square',
            rotation: rand(0, Math.PI),
            spin: randSpread(6),
            additive: true,
          });
        }

        soundCooldown -= dt;
        if (soundCooldown <= 0) {
          sound.sparkle();
          soundCooldown = rand(0.25, 0.6);
        }

        prev = { x: tip.x, y: tip.y };
      },
    };
  },
};
