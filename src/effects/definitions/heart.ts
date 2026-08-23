// =============================================================================
// 💖 양손 하트
// =============================================================================
// 손 모양: 양손의 엄지와 검지를 맞대어 하트 만들기 (🫶)
//
// 이 이펙트만 유일하게 "두 손"을 씁니다. 두 손의 엄지끝과 검지끝이 서로
// 가까워졌을 때 발동하며, 두 손 사이의 중심에서 하트가 피어오릅니다.

import { LM } from '../../utils/landmarkUtils';
import { rand, randSpread } from '../ParticleEngine';
import type { EffectContext, EffectDefinition } from '../types';

/** 초당 생성할 하트 수. */
const HEARTS_PER_SECOND = 14;

export const heartEffect: EffectDefinition = {
  id: 'heart',
  label: '하트',
  screenWide: false,
  shape: { fingers: { thumb: true, index: true, middle: false, ring: false, pinky: false }, hands: 2, joined: true },
  hint: '양손 엄지와 검지를 맞대어 하트 만들기',

  create() {
    let carry = 0;
    let soundCooldown = 0;

    return {
      onHold(ctx: EffectContext) {
        const { points, secondPoints, handScale, engine, sound, dt } = ctx;

        // 두 손의 중심점을 구합니다. 보조 손이 없으면 주 손만 씁니다.
        let centerX: number;
        let centerY: number;
        if (secondPoints) {
          const a = points[LM.INDEX_TIP];
          const b = secondPoints[LM.INDEX_TIP];
          const c = points[LM.THUMB_TIP];
          const d = secondPoints[LM.THUMB_TIP];
          centerX = (a.x + b.x + c.x + d.x) / 4;
          centerY = (a.y + b.y + c.y + d.y) / 4;
        } else {
          centerX = points[LM.INDEX_TIP].x;
          centerY = points[LM.INDEX_TIP].y;
        }

        carry += HEARTS_PER_SECOND * dt;
        const count = Math.floor(carry);
        carry -= count;

        for (let i = 0; i < count; i++) {
          engine.spawn({
            x: centerX + randSpread(handScale * 0.5),
            y: centerY + randSpread(handScale * 0.3),
            vx: randSpread(70),
            // 위로 두둥실 떠오릅니다.
            vy: -rand(90, 210),
            ax: randSpread(40),
            life: rand(1.2, 2.2),
            size: rand(14, 30) * (handScale / 100),
            sizeEnd: rand(6, 14) * (handScale / 100),
            // 분홍 ~ 빨강 계열
            hue: rand(325, 355),
            sat: 90,
            light: rand(60, 78),
            alphaStart: 0.95,
            alphaEnd: 0,
            drag: 0.75,
            shape: 'heart',
            rotation: randSpread(0.5),
            spin: randSpread(1.6),
            additive: false,
          });
        }

        // 하트 사이사이에 작은 반짝임을 섞습니다.
        if (Math.random() < dt * 30) {
          engine.spawn({
            x: centerX + randSpread(handScale * 0.9),
            y: centerY + randSpread(handScale * 0.7),
            vx: randSpread(50),
            vy: -rand(40, 120),
            life: rand(0.5, 1.0),
            size: rand(2, 5),
            sizeEnd: 0,
            hue: rand(330, 360),
            sat: 100,
            light: 85,
            drag: 0.7,
            shape: 'circle',
            additive: true,
          });
        }

        soundCooldown -= dt;
        if (soundCooldown <= 0) {
          sound.chime();
          soundCooldown = rand(0.8, 1.4);
        }
      },
    };
  },
};
