// =============================================================================
// 💥 핑거스냅 (엄지 + 중지)
// =============================================================================
// 손 모양: 엄지와 중지를 펴서 맞대기 (실제로 스냅하는 자세)
//
// 발동 순간 손끝에서 먼지가 흩날리듯 입자가 퍼집니다.
// 한 번만 터지는 이펙트라 onEnter만 구현합니다.

import { LM } from '../../utils/landmarkUtils';
import { rand, randSpread } from '../ParticleEngine';
import type { EffectContext, EffectDefinition } from '../types';

export const snapEffect: EffectDefinition = {
  id: 'snap',
  label: '핑거스냅',
  shape: { fingers: { thumb: true, index: false, middle: false, ring: false, pinky: false }, pinch: 'middle' },
  hint: '엄지와 중지를 펴서 맞대기 (스냅 자세)',

  create() {
    return {
      onEnter(ctx: EffectContext) {
        const { points, handScale, engine, sound } = ctx;

        // 엄지끝과 중지끝의 중간 지점에서 터집니다.
        const thumb = points[LM.THUMB_TIP];
        const middle = points[LM.MIDDLE_TIP];
        const x = (thumb.x + middle.x) / 2;
        const y = (thumb.y + middle.y) / 2;

        // --- 순간적인 섬광 링 ---
        engine.spawn({
          x,
          y,
          life: 0.3,
          size: handScale * 0.2,
          sizeEnd: handScale * 2.2,
          hue: 45,
          sat: 100,
          light: 85,
          alphaStart: 0.9,
          alphaEnd: 0,
          shape: 'ring',
          additive: true,
        });

        // --- 흩날리는 먼지 ---
        for (let i = 0; i < 70; i++) {
          const angle = rand(0, Math.PI * 2);
          const speed = rand(80, 620);
          engine.spawn({
            x: x + randSpread(handScale * 0.1),
            y: y + randSpread(handScale * 0.1),
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            // 먼지처럼 천천히 흩어지며 떠다닙니다.
            ay: rand(-60, 120),
            life: rand(0.5, 1.4),
            size: rand(2, 6),
            sizeEnd: 0,
            hue: rand(25, 45),
            sat: rand(30, 80),
            light: rand(60, 85),
            alphaStart: 0.85,
            alphaEnd: 0,
            drag: 0.3,
            shape: 'circle',
            additive: true,
          });
        }

        sound.snap();
      },
    };
  },
};
