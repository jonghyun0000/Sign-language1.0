// =============================================================================
// 🔥 화염 방사 (손바닥)
// =============================================================================
// 손 모양: 다섯 손가락을 모두 펴서 손바닥 보이기
//
// 구현 아이디어:
//   손바닥 중심에서 손이 향한 방향으로 불꽃 입자를 계속 뿜습니다.
//   * 갓 나온 입자는 흰색~노란색(뜨거움) → 시간이 지나며 주황~빨강으로.
//   * 위로 뜨는 부력(ay 음수)을 주면 진짜 불처럼 일렁입니다.
//   * 加算 합성(additive)이라 겹칠수록 밝아져 불길의 중심이 하얗게 빛납니다.

import { LM } from '../../utils/landmarkUtils';
import { rand, randSpread } from '../ParticleEngine';
import type { EffectContext, EffectDefinition } from '../types';

/** 초당 생성할 불꽃 입자 수. */
const PARTICLES_PER_SECOND = 320;
/** 초당 생성할 연기 입자 수. */
const SMOKE_PER_SECOND = 40;

export const fireEffect: EffectDefinition = {
  id: 'fire',
  label: '화염 방사',
  shape: { fingers: { thumb: true, index: true, middle: true, ring: true, pinky: true } },
  hint: '다섯 손가락을 모두 펴서 손바닥 보이기',

  create() {
    // 프레임 시간이 들쭉날쭉해도 초당 생성량이 일정하도록 "남은 소수점"을
    // 누적해 둡니다. (예: 한 프레임에 5.4개 → 5개 생성 후 0.4를 다음으로)
    let carry = 0;
    let smokeCarry = 0;

    return {
      onEnter(ctx: EffectContext) {
        ctx.sound.startFire();
      },

      onHold(ctx: EffectContext) {
        const { points, handScale, engine, dt } = ctx;

        // 손바닥 중심 = 손목과 중지 MCP의 중간쯤.
        const wrist = points[LM.WRIST];
        const middleMcp = points[LM.MIDDLE_MCP];
        const originX = wrist.x + (middleMcp.x - wrist.x) * 0.75;
        const originY = wrist.y + (middleMcp.y - wrist.y) * 0.75;

        // 분사 방향 = 손목 → 중지 MCP.
        const dx = middleMcp.x - wrist.x;
        const dy = middleMcp.y - wrist.y;
        const mag = Math.hypot(dx, dy) || 1e-6;
        const dirX = dx / mag;
        const dirY = dy / mag;

        // --- 불꽃 ---
        carry += PARTICLES_PER_SECOND * dt;
        const count = Math.floor(carry);
        carry -= count;

        for (let i = 0; i < count; i++) {
          // 분사구를 조금 넓혀 뿌리가 두툼해 보이게 합니다.
          const spawnJitter = handScale * 0.18;
          const speed = rand(180, 520) * (handScale / 100);
          // 방향을 ±25° 정도 흩뿌립니다.
          const angle = randSpread(0.45);
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);

          engine.spawn({
            x: originX + randSpread(spawnJitter),
            y: originY + randSpread(spawnJitter),
            vx: (dirX * cos - dirY * sin) * speed,
            vy: (dirX * sin + dirY * cos) * speed,
            // 부력: 위로 뜨는 힘 (y가 아래로 +이므로 음수가 "위")
            ay: -rand(120, 320),
            life: rand(0.35, 0.75),
            size: rand(6, 16) * (handScale / 100),
            sizeEnd: 0,
            // 20(주황) ~ 55(노랑) 사이에서 시작 — 겹치면 하얗게 타오릅니다.
            hue: rand(18, 52),
            sat: 100,
            light: rand(55, 75),
            alphaStart: 0.85,
            alphaEnd: 0,
            drag: 0.35,
            shape: 'circle',
            additive: true,
          });
        }

        // --- 연기 (불꽃보다 느리고 어둡게, 일반 합성) ---
        smokeCarry += SMOKE_PER_SECOND * dt;
        const smokeCount = Math.floor(smokeCarry);
        smokeCarry -= smokeCount;

        for (let i = 0; i < smokeCount; i++) {
          const speed = rand(60, 160) * (handScale / 100);
          const angle = randSpread(0.6);
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          engine.spawn({
            x: originX + randSpread(handScale * 0.2),
            y: originY + randSpread(handScale * 0.2),
            vx: (dirX * cos - dirY * sin) * speed,
            vy: (dirX * sin + dirY * cos) * speed,
            ay: -rand(60, 140),
            life: rand(0.8, 1.6),
            size: rand(10, 22) * (handScale / 100),
            sizeEnd: rand(30, 60) * (handScale / 100),
            hue: 25,
            sat: 12,
            light: 22,
            alphaStart: 0.28,
            alphaEnd: 0,
            drag: 0.5,
            shape: 'circle',
            additive: false,
          });
        }
      },

      onExit(ctx: EffectContext) {
        // 손을 내리면 화염 소리를 멈춥니다.
        ctx.sound.stopLoop();
      },
    };
  },
};
