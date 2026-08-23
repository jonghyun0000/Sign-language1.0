// =============================================================================
// confusion.ts — 규칙끼리 얼마나 헷갈리는지 객관적으로 측정
// =============================================================================
// 실행:  npm run confusion
//
// 왜 이 테스트가 필요한가?
//   기존 verify.ts 의 테스트는 "제가 만든 가상의 손"이 "제가 만든 규칙"을
//   통과하는지 보는 것이라 순환논리였습니다. 통과해도 실제로 잘 되는지는
//   알 수 없었습니다.
//
//   혼동 행렬은 다릅니다. **규칙 집합 자체의 성질**을 측정합니다.
//   ㄱ 손 모양을 만들었을 때 ㄱ 규칙이 1등을 하는지, 2등과 점수 차이가
//   얼마나 나는지를 봅니다. 차이가 작으면 실제 카메라의 미세한 떨림만으로도
//   뒤집힙니다. 이건 가상의 손을 어떻게 만들든 상관없이 유효한 결론입니다.
//
//   실제 지문자를 반영하면서 ㄱ/ㄴ(둘 다 6형), ㄷ/ㅅ(둘 다 2형)처럼 손 모양이
//   같고 방향만 다른 쌍이 생겼습니다. 이게 얼마나 위험한지 숫자로 봅니다.

import { GESTURE_RULES } from '../src/data/koreanGestures';
import { LM } from '../src/utils/landmarkUtils';
import type { GestureShape, HandLandmarks, Landmark } from '../src/types';

const p = (x: number, y: number): Landmark => ({ x, y, z: 0 });

/**
 * 손 모양 데이터(GestureShape)로부터 가상의 손 좌표를 만듭니다.
 *
 * 중요: 이 함수는 규칙의 점수 함수를 보지 않고 **선언된 손 모양만** 봅니다.
 * 그래서 "규칙이 자기 자신을 알아보는가"와 "다른 규칙과 헷갈리는가"를
 * 따로 측정할 수 있습니다.
 */
export function buildHandFromShape(
  shape: GestureShape,
  /** 손 전체에 줄 무작위 흔들림(정규화 좌표 단위). 0이면 이상적인 손. */
  jitter = 0,
): HandLandmarks {
  const lm: Landmark[] = new Array(21);
  const j = () => (jitter === 0 ? 0 : (Math.random() * 2 - 1) * jitter);

  // 손목과 손등 관절.
  lm[LM.WRIST] = p(0.5, 0.9);
  const mcpX = { index: 0.44, middle: 0.5, ring: 0.56, pinky: 0.62 };
  lm[LM.INDEX_MCP] = p(mcpX.index, 0.6);
  lm[LM.MIDDLE_MCP] = p(mcpX.middle, 0.6);
  lm[LM.RING_MCP] = p(mcpX.ring, 0.6);
  lm[LM.PINKY_MCP] = p(mcpX.pinky, 0.6);

  // 방향 벡터 (화면 기준 → 원본 좌표계에서는 x가 반대).
  const dirMap: Record<string, [number, number]> = {
    up: [0, -1],
    down: [0, 1],
    right: [-1, 0],
    left: [1, 0],
  };
  const [dx, dy] = dirMap[shape.direction ?? 'up'];

  const fingers = [
    { key: 'index' as const, x: mcpX.index, mcp: LM.INDEX_MCP, pip: LM.INDEX_PIP, dip: LM.INDEX_DIP, tip: LM.INDEX_TIP },
    { key: 'middle' as const, x: mcpX.middle, mcp: LM.MIDDLE_MCP, pip: LM.MIDDLE_PIP, dip: LM.MIDDLE_DIP, tip: LM.MIDDLE_TIP },
    { key: 'ring' as const, x: mcpX.ring, mcp: LM.RING_MCP, pip: LM.RING_PIP, dip: LM.RING_DIP, tip: LM.RING_TIP },
    { key: 'pinky' as const, x: mcpX.pinky, mcp: LM.PINKY_MCP, pip: LM.PINKY_PIP, dip: LM.PINKY_DIP, tip: LM.PINKY_TIP },
  ];

  for (const f of fingers) {
    const base = lm[f.mcp];
    const extended = shape.fingers[f.key];
    // 붙임/벌림에 따라 검지·중지를 좌우로 옮깁니다.
    let sideways = 0;
    if (shape.spread && (f.key === 'index' || f.key === 'middle')) {
      const pull = shape.spread === 'narrow' ? 0.015 : -0.05;
      sideways = f.key === 'index' ? pull : -pull;
    }

    if (!extended) {
      // 접은 손가락: 손끝이 손목 쪽으로 말립니다.
      lm[f.pip] = p(f.x + j(), 0.52 + j());
      lm[f.dip] = p(f.x + j(), 0.58 + j());
      lm[f.tip] = p(f.x + j(), 0.62 + j());
      continue;
    }

    // 갈퀴형이거나 검지 꺾임이면 첫마디만 펴고 둘째마디를 굽힙니다.
    const isBent = shape.claw || (shape.bent && f.key === 'index');

    if (isBent) {
      // 첫마디는 방향대로 뻗고, 그다음 마디가 손바닥 쪽으로 직각에 가깝게
      // 꺾입니다. 꺾이는 방향은 뻗은 방향에 수직입니다.
      const perpX = -dy;
      const perpY = dx;
      const reach = 0.07;
      lm[f.pip] = p(base.x + dx * reach + sideways + j(), base.y + dy * reach + j());
      lm[f.dip] = p(
        base.x + dx * reach + perpX * 0.03 + sideways + j(),
        base.y + dy * reach + perpY * 0.03 + j(),
      );
      lm[f.tip] = p(
        base.x + dx * reach + perpX * 0.06 + sideways + j(),
        base.y + dy * reach + perpY * 0.06 + j(),
      );
      continue;
    }

    // 편 손가락: 방향대로 곧게 뻗습니다.
    lm[f.pip] = p(base.x + dx * 0.06 + sideways + j(), base.y + dy * 0.06 + j());
    lm[f.dip] = p(base.x + dx * 0.1 + sideways + j(), base.y + dy * 0.1 + j());
    lm[f.tip] = p(base.x + dx * 0.14 + sideways + j(), base.y + dy * 0.14 + j());
  }

  // --- 엄지 ---
  if (shape.pinch) {
    // 엄지가 검지(또는 중지) 끝에 붙어 고리를 만듭니다.
    const target = shape.pinch === 'index' ? lm[LM.INDEX_TIP] : lm[LM.MIDDLE_TIP];
    lm[LM.THUMB_CMC] = p(0.44, 0.82);
    lm[LM.THUMB_MCP] = p(0.4, 0.74);
    lm[LM.THUMB_IP] = p((0.4 + target.x) / 2, (0.74 + target.y) / 2);
    lm[LM.THUMB_TIP] = p(target.x + 0.012 + j(), target.y + 0.012 + j());
  } else if (shape.fingers.thumb) {
    // 편 엄지: 손가락 방향을 따라가는 게 아니라 **옆으로 벌어집니다**.
    // (해부학적으로 엄지는 다른 손가락과 수직 평면으로 움직입니다)
    // 예전에는 방향을 따라 뻗게 만들어서 엄지가 검지 뿌리에 너무 가까웠고,
    // 그 결과 isThumbExtended 가 "접힘"으로 읽어 ㅈ·사랑합니다가 실패했습니다.
    const perpX = -dy;
    const perpY = dx;
    // 뻗는 방향 성분 + 옆으로 벌어지는 성분을 함께 줍니다.
    const out = (t: number) => ({
      x: 0.44 + dx * 0.05 * t + perpX * 0.16 * t,
      y: 0.78 + dy * 0.05 * t + perpY * 0.16 * t,
    });
    const cmc = out(0.2);
    const mcp = out(0.45);
    const ip = out(0.75);
    const tip = out(1);
    lm[LM.THUMB_CMC] = p(cmc.x, cmc.y);
    lm[LM.THUMB_MCP] = p(mcp.x + j(), mcp.y + j());
    lm[LM.THUMB_IP] = p(ip.x + j(), ip.y + j());
    lm[LM.THUMB_TIP] = p(tip.x + j(), tip.y + j());
  } else {
    // 접은 엄지: 검지 관절에 붙습니다.
    lm[LM.THUMB_CMC] = p(0.46, 0.82);
    lm[LM.THUMB_MCP] = p(0.46, 0.74);
    lm[LM.THUMB_IP] = p(0.46, 0.66);
    lm[LM.THUMB_TIP] = p(0.46 + j(), 0.6 + j());
  }

  return lm;
}

// -----------------------------------------------------------------------------
// 측정
// -----------------------------------------------------------------------------

interface Row {
  label: string;
  category: string;
  confidence: string;
  /** 자기 규칙의 점수. */
  own: number;
  /** 1등 규칙의 라벨. */
  winner: string;
  /** 2등 규칙의 라벨과 점수. */
  runnerUp: string;
  runnerUpScore: number;
  /** 1등과 2등의 점수 차이. 작을수록 위험합니다. */
  margin: number;
}

/**
 * 한 손 모양을 규칙들에 넣어 점수를 매깁니다.
 *
 * @param sameCategoryOnly true면 같은 카테고리끼리만 경쟁시킵니다.
 *   실제 앱은 사전 모드(스마트/자음/모음/단어)로 후보를 좁히므로,
 *   이쪽이 현실에 가까운 조건입니다.
 */
function measure(
  rule: (typeof GESTURE_RULES)[number],
  jitter: number,
  sameCategoryOnly: boolean,
): Row {
  const hand = buildHandFromShape(rule.shape, jitter);

  // 스마트 모드는 "기대하는 자모 종류 + 단어"를 후보로 둡니다.
  // 단어가 자모와 충돌하면 여기서 바로 드러납니다.
  const pool = sameCategoryOnly
    ? GESTURE_RULES.filter(
        (r) => r.category === rule.category || r.category === 'word',
      )
    : GESTURE_RULES;

  const scored = pool
    .map((r) => ({ label: r.label, score: r.score(hand) }))
    .sort((a, b) => b.score - a.score);

  const own = scored.find((s) => s.label === rule.label)?.score ?? 0;

  return {
    label: rule.label,
    category: rule.category,
    confidence: rule.confidence,
    own,
    winner: scored[0].label,
    runnerUp: scored[1].label,
    runnerUpScore: scored[1].score,
    margin: scored[0].score - scored[1].score,
  };
}

/** 위험도에 따라 표시를 붙입니다. */
function verdict(row: Row): string {
  if (row.winner !== row.label) return '실패';
  if (row.margin < 0.05) return '매우 위험';
  if (row.margin < 0.12) return '위험';
  if (row.margin < 0.25) return '주의';
  return '양호';
}

function runMatrix(jitter: number, title: string, sameCategoryOnly = false) {
  console.log(`\n${'='.repeat(78)}`);
  console.log(title);
  console.log('='.repeat(78));
  console.log(
    '글자'.padEnd(12) +
      '판정'.padEnd(12) +
      '자기점수'.padEnd(11) +
      '1등'.padEnd(14) +
      '2등'.padEnd(16) +
      '차이',
  );
  console.log('-'.repeat(78));

  const rows = GESTURE_RULES.map((r) => measure(r, jitter, sameCategoryOnly));
  let fail = 0;
  let risky = 0;

  for (const row of rows) {
    const v = verdict(row);
    if (v === '실패') fail += 1;
    else if (v === '매우 위험' || v === '위험') risky += 1;

    console.log(
      row.label.padEnd(12) +
        v.padEnd(12) +
        row.own.toFixed(3).padEnd(11) +
        row.winner.padEnd(14) +
        `${row.runnerUp}(${row.runnerUpScore.toFixed(2)})`.padEnd(16) +
        row.margin.toFixed(3),
    );
  }

  console.log('-'.repeat(78));
  console.log(
    `전체 ${rows.length}개 · 오인식 ${fail}개 · 아슬아슬 ${risky}개 · ` +
      `안전 ${rows.length - fail - risky}개`,
  );

  // 가장 위험한 쌍을 따로 보고합니다.
  const worst = rows
    .filter((r) => r.winner === r.label)
    .sort((a, b) => a.margin - b.margin)
    .slice(0, 6);
  console.log('\n가장 헷갈리는 조합 (차이가 작을수록 실제 카메라에서 뒤집히기 쉬움):');
  for (const r of worst) {
    console.log(`  ${r.label} ↔ ${r.runnerUp}   차이 ${r.margin.toFixed(3)}`);
  }

  return { fail, risky, total: rows.length };
}

// 1) 전체 경쟁 — 사전 모드를 '전체'로 두었을 때의 최악 조건
const ideal = runMatrix(
  0,
  "1. 전체 경쟁 (사전 모드 '전체') — 25개 규칙이 모두 경쟁하는 최악 조건",
);

// 2) 같은 카테고리끼리만 — 스마트/자음/모음/단어 모드의 실제 조건
console.log('\n');
const scoped = runMatrix(
  0,
  '2. 스마트 모드 (기대 자모 + 단어) — 앱의 기본 설정과 같은 조건',
  true,
);

// 3) 카테고리 분리 + 노이즈 — 가장 현실에 가까운 조건
console.log('\n');
const noisy = runMatrix(
  0.012,
  '3. 스마트 모드 + 카메라 떨림(±0.012) — 실사용에 가장 가까운 조건',
  true,
);

// -----------------------------------------------------------------------------
// 요약
// -----------------------------------------------------------------------------
console.log(`\n${'='.repeat(78)}`);
console.log('요약');
console.log('='.repeat(78));
console.log(
  `전체 경쟁      : 오인식 ${ideal.fail}/${ideal.total}, 아슬아슬 ${ideal.risky}/${ideal.total}`,
);
console.log(
  `스마트 모드    : 오인식 ${scoped.fail}/${scoped.total}, 아슬아슬 ${scoped.risky}/${scoped.total}`,
);
console.log(
  `스마트 + 떨림  : 오인식 ${noisy.fail}/${noisy.total}, 아슬아슬 ${noisy.risky}/${noisy.total}`,
);
console.log(
  '\n→ 이 차이가 "스마트 모드"가 선택 사항이 아니라 필수인 이유입니다.',
);
console.log(
  '\n주의: 이 수치는 실제 카메라 성능이 아닙니다. 가상의 손으로 측정한',
);
console.log(
  '"규칙끼리 얼마나 구분되는가"입니다. 실제 인식률은 반드시 카메라로 측정해야 합니다.',
);
