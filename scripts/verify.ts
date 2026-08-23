// =============================================================================
// verify.ts — 브라우저 없이 순수 로직을 검증하는 스크립트
// =============================================================================
// 실행:  npm run verify
//
// 카메라가 필요한 부분(MediaPipe, 캔버스)은 여기서 확인할 수 없지만,
// 이 앱에서 버그가 나기 쉬운 "계산 로직"은 전부 여기서 검증합니다.
//
//   1. 한글 자모 조합기 (ㄱ + ㅏ + ㅁ → 감)
//   2. 제스처 분류기 (가상의 손 좌표로 ㅁ, ㅏ, 안녕하세요 인식)
//   3. 이펙트 감지기 (스파이더맨 손 모양 → web 이벤트)
//
// 손 좌표는 실제 카메라 대신 "가상의 손"을 만들어 넣습니다. 손가락을 폈다/
// 접었다만 바꿔가며 규칙이 의도대로 반응하는지 확인하는 방식입니다.

import { HangulComposer } from '../src/utils/hangulComposer';
import { classifyHand } from '../src/data/koreanGestures';
import { EffectGestureDetector } from '../src/services/EffectGestureDetector';
import { getFingerState, LM } from '../src/utils/landmarkUtils';
import { GESTURE_RULES } from '../src/data/koreanGestures';
import { getEffectCatalog } from '../src/effects/EffectManager';
import { TWO_HAND_UPGRADE, isScreenWideEffect } from '../src/types';
import { buildHandFromShape } from './confusion';
import { CoachService } from '../src/services/CoachService';
import { LESSONS, totalPracticeSteps } from '../src/data/lessons';
import type { HandLandmarks, Landmark } from '../src/types';

// -----------------------------------------------------------------------------
// 아주 작은 테스트 도구 (외부 테스트 러너 없이 동작)
// -----------------------------------------------------------------------------
let passed = 0;
let failed = 0;

function check(name: string, actual: unknown, expected: unknown): void {
  const ok = Object.is(actual, expected);
  if (ok) {
    passed += 1;
    console.log(`  ✅ ${name}`);
  } else {
    failed += 1;
    console.log(`  ❌ ${name}`);
    console.log(`     기대값: ${JSON.stringify(expected)}`);
    console.log(`     실제값: ${JSON.stringify(actual)}`);
  }
}

function checkTrue(name: string, actual: boolean): void {
  check(name, actual, true);
}

function section(title: string): void {
  console.log(`\n${title}`);
  console.log('─'.repeat(60));
}

// -----------------------------------------------------------------------------
// 가상의 손 만들기
// -----------------------------------------------------------------------------
// 좌표계: x는 오른쪽으로, y는 아래로 증가 (이미지 좌표계와 동일).
// 손목을 아래(y=0.9)에 두고 손가락이 위(y가 작아지는 방향)를 향하게 만듭니다.

const p = (x: number, y: number): Landmark => ({ x, y, z: 0 });

interface HandSpec {
  thumb: boolean;
  index: boolean;
  middle: boolean;
  ring: boolean;
  pinky: boolean;
}

/**
 * 지정한 손가락만 편 가상의 손을 만듭니다.
 * 각 손가락은 "폈으면 손끝이 손목에서 멀고, 접었으면 가깝다"는 규칙만
 * 만족하면 되므로 y좌표만 다르게 배치합니다.
 */
function makeHand(spec: HandSpec): HandLandmarks {
  const lm: Landmark[] = new Array(21);

  lm[LM.WRIST] = p(0.5, 0.9);

  // 네 손가락의 MCP(손등 관절)를 가로로 배치합니다.
  const mcpX = { index: 0.44, middle: 0.5, ring: 0.56, pinky: 0.62 };
  lm[LM.INDEX_MCP] = p(mcpX.index, 0.6);
  lm[LM.MIDDLE_MCP] = p(mcpX.middle, 0.6); // 손 크기 기준점 (손목과 0.3 거리)
  lm[LM.RING_MCP] = p(mcpX.ring, 0.6);
  lm[LM.PINKY_MCP] = p(mcpX.pinky, 0.6);

  // 손가락별 PIP / DIP / TIP 배치.
  const fingers = [
    { key: 'index' as const, x: mcpX.index, pip: LM.INDEX_PIP, dip: LM.INDEX_DIP, tip: LM.INDEX_TIP },
    { key: 'middle' as const, x: mcpX.middle, pip: LM.MIDDLE_PIP, dip: LM.MIDDLE_DIP, tip: LM.MIDDLE_TIP },
    { key: 'ring' as const, x: mcpX.ring, pip: LM.RING_PIP, dip: LM.RING_DIP, tip: LM.RING_TIP },
    { key: 'pinky' as const, x: mcpX.pinky, pip: LM.PINKY_PIP, dip: LM.PINKY_DIP, tip: LM.PINKY_TIP },
  ];

  for (const f of fingers) {
    if (spec[f.key]) {
      // 편 손가락: 위로 곧게 뻗습니다 (손목에서 점점 멀어짐).
      lm[f.pip] = p(f.x, 0.5);
      lm[f.dip] = p(f.x, 0.45);
      lm[f.tip] = p(f.x, 0.4);
    } else {
      // 접은 손가락: 손바닥 쪽으로 말립니다 (손끝이 손목에 가까워짐).
      lm[f.pip] = p(f.x, 0.52);
      lm[f.dip] = p(f.x, 0.58);
      lm[f.tip] = p(f.x, 0.62);
    }
  }

  // 엄지: 편 상태면 옆으로 크게 벌어지고, 접으면 검지 MCP에 붙습니다.
  if (spec.thumb) {
    lm[LM.THUMB_CMC] = p(0.42, 0.82);
    lm[LM.THUMB_MCP] = p(0.36, 0.74);
    lm[LM.THUMB_IP] = p(0.30, 0.68);
    lm[LM.THUMB_TIP] = p(0.25, 0.62);
  } else {
    lm[LM.THUMB_CMC] = p(0.46, 0.82);
    lm[LM.THUMB_MCP] = p(0.46, 0.74);
    lm[LM.THUMB_IP] = p(0.46, 0.66);
    lm[LM.THUMB_TIP] = p(0.46, 0.6);
  }

  return lm;
}

/** 검지만 펴서 특정 방향을 가리키는 손 (모음 ㅏ/ㅓ/ㅗ/ㅜ 검증용). */
function makePointingHand(dir: 'up' | 'down' | 'left' | 'right'): HandLandmarks {
  const lm = makeHand({
    thumb: false,
    index: true,
    middle: false,
    ring: false,
    pinky: false,
  });

  const mcp = lm[LM.INDEX_MCP]; // (0.44, 0.6)

  // 화면(거울) 기준 방향으로 손끝을 옮깁니다.
  // 거울이므로 화면의 "오른쪽"은 원본 좌표에서 x가 작아지는 쪽입니다.
  const offsets: Record<typeof dir, [number, number]> = {
    up: [0, -1],
    down: [0, 1],
    right: [-1, 0], // 거울 반전
    left: [1, 0],
  };
  const [ox, oy] = offsets[dir];

  // MCP → PIP → DIP → TIP 을 한 방향으로 곧게 배치합니다(직선 = 굽힘 없음).
  lm[LM.INDEX_PIP] = p(mcp.x + ox * 0.06, mcp.y + oy * 0.06);
  lm[LM.INDEX_DIP] = p(mcp.x + ox * 0.1, mcp.y + oy * 0.1);
  lm[LM.INDEX_TIP] = p(mcp.x + ox * 0.14, mcp.y + oy * 0.14);

  return lm;
}

// =============================================================================
// 1. 한글 자모 조합기
// =============================================================================
section('1. 한글 자모 조합기 (HangulComposer)');
{
  // 기본 조합: 초성 + 중성
  const c1 = new HangulComposer();
  c1.push('ㄱ');
  c1.push('ㅏ');
  check('ㄱ + ㅏ → 가', c1.text, '가');

  // 받침 붙이기
  c1.push('ㅁ');
  check('가 + ㅁ → 감', c1.text, '감');

  // 다음 글자로 이어지기
  c1.push('ㅅ');
  c1.push('ㅏ');
  check('감 + ㅅ + ㅏ → 감사', c1.text, '감사');

  // 받침이 다음 글자의 초성으로 넘어가는 규칙
  const c2 = new HangulComposer();
  ['ㄱ', 'ㅏ', 'ㄱ', 'ㅏ'].forEach((j) => c2.push(j));
  check('ㄱㅏㄱㅏ → 가가 (받침이 다음 초성으로 이동)', c2.text, '가가');

  // 복합 모음
  const c3 = new HangulComposer();
  ['ㅎ', 'ㅗ', 'ㅏ'].forEach((j) => c3.push(j));
  check('ㅎ + ㅗ + ㅏ → 화 (ㅗ+ㅏ=ㅘ)', c3.text, '화');

  // 겹받침
  const c4 = new HangulComposer();
  ['ㄷ', 'ㅏ', 'ㄹ', 'ㄱ'].forEach((j) => c4.push(j));
  check('ㄷㅏㄹㄱ → 닭 (겹받침 ㄺ)', c4.text, '닭');

  // 쌍자음
  const c5 = new HangulComposer();
  ['ㄲ', 'ㅜ', 'ㅁ'].forEach((j) => c5.push(j));
  check('ㄲ + ㅜ + ㅁ → 꿈', c5.text, '꿈');

  const c6 = new HangulComposer();
  ['ㄱ', 'ㄱ', 'ㅜ', 'ㅁ'].forEach((j) => c6.push(j));
  check('ㄱ + ㄱ + ㅜ + ㅁ → 꿈 (같은 자음 두 번 = 쌍자음)', c6.text, '꿈');

  // 단어 입력
  const c7 = new HangulComposer();
  c7.push('ㄱ');
  c7.pushWord('안녕하세요 ');
  check('조합 중이던 ㄱ이 확정된 뒤 단어가 붙는다', c7.text, 'ㄱ안녕하세요 ');

  // 백스페이스
  const c8 = new HangulComposer();
  ['ㄱ', 'ㅏ', 'ㅁ'].forEach((j) => c8.push(j));
  c8.backspace();
  check('감 → 백스페이스 → 가', c8.text, '가');
  c8.backspace();
  check('가 → 백스페이스 → ㄱ', c8.text, 'ㄱ');
  c8.backspace();
  check('ㄱ → 백스페이스 → (빈 문자열)', c8.text, '');
  c8.backspace();
  check('빈 상태에서 백스페이스해도 오류 없음', c8.text, '');

  // 확정된 글자도 되살려서 지우기
  const c9 = new HangulComposer();
  ['ㄱ', 'ㅏ', 'ㅁ', 'ㅅ', 'ㅏ'].forEach((j) => c9.push(j));
  check('감사 확인', c9.text, '감사');
  c9.backspace();
  check('감사 → 백스페이스 → 감ㅅ', c9.text, '감ㅅ');

  // 띄어쓰기
  const c10 = new HangulComposer();
  ['ㄱ', 'ㅏ'].forEach((j) => c10.push(j));
  c10.space();
  check('가 + 띄어쓰기 → "가 "', c10.text, '가 ');

  // 스마트 모드가 참고하는 "다음에 기대하는 자모"
  const c11 = new HangulComposer();
  check('빈 상태에서는 자음을 기다림', c11.expecting, 'consonant');
  c11.push('ㄱ');
  check('초성 입력 후에는 모음을 기다림', c11.expecting, 'vowel');
  c11.push('ㅏ');
  check('글자가 완성되면 다시 자음을 기다림', c11.expecting, 'consonant');
}

// =============================================================================
// 2. 제스처 분류기
// =============================================================================
section('2. 제스처 분류기 (classifyHand)');
{
  // 손가락 상태 판별이 먼저 정확해야 합니다.
  const fist = makeHand({
    thumb: false,
    index: false,
    middle: false,
    ring: false,
    pinky: false,
  });
  const fistState = getFingerState(fist);
  checkTrue(
    '주먹: 다섯 손가락 모두 접힘으로 판별',
    !fistState.thumb &&
      !fistState.index &&
      !fistState.middle &&
      !fistState.ring &&
      !fistState.pinky,
  );

  const openHand = makeHand({
    thumb: true,
    index: true,
    middle: true,
    ring: true,
    pinky: true,
  });
  const openState = getFingerState(openHand);
  checkTrue(
    '편 손: 다섯 손가락 모두 펴짐으로 판별',
    openState.thumb &&
      openState.index &&
      openState.middle &&
      openState.ring &&
      openState.pinky,
  );

  // 단어 인식
  check('편 손 → 안녕하세요', classifyHand(openHand, ['word']).label, '안녕하세요');

  // --- 모든 자모가 자기 손 모양으로 인식되는지 ---
  //
  // 손 좌표는 규칙에 선언된 손 모양(shape)에서 만들어 냅니다. 그래서
  // "규칙을 고치면 테스트도 같이 따라오는" 구조가 됩니다. 예전처럼 손 좌표를
  // 손으로 적어두면 규칙을 고칠 때마다 테스트가 낡아버립니다.
  for (const category of ['consonant', 'vowel'] as const) {
    const rules = GESTURE_RULES.filter((r) => r.category === category);
    const failures: string[] = [];

    for (const rule of rules) {
      const hand = buildHandFromShape(rule.shape);
      const result = classifyHand(hand, [category]);
      if (result.label !== rule.label) {
        failures.push(`${rule.label}→${result.label ?? '없음'}`);
      }
    }

    const name = category === 'consonant' ? '자음' : '모음';
    check(
      `${name} ${rules.length}개가 모두 자기 손 모양으로 인식됨` +
        (failures.length ? ` (실패: ${failures.join(', ')})` : ''),
      failures.length,
      0,
    );
  }

  // --- 아래를 향하는 글자가 인식되는지 (예전에 구조적으로 불가능했던 부분) ---
  //
  // 손가락 폄 판정이 손목 기준 거리를 쓰던 시절에는, 아래를 향한 손가락이
  // 항상 "접힘"으로 읽혀 ㅅ·ㅜ·ㅠ 가 절대 인식되지 않았습니다.
  // MCP 기준으로 바꾼 뒤 고쳐졌고, 다시 깨지지 않도록 못을 박아 둡니다.
  for (const label of ['ㅅ', 'ㅜ', 'ㅠ']) {
    const rule = GESTURE_RULES.find((r) => r.label === label);
    if (!rule) continue;
    const hand = buildHandFromShape(rule.shape);
    const result = classifyHand(hand, [rule.category]);
    check(`아래를 향하는 ${label} 인식 (회귀 방지)`, result.label, label);
  }

  // --- 단어가 기본(스마트) 모드에서 인식되는지 (회귀 방지) ---
  //
  // 한때 단어 손 모양이 자모와 완전히 겹쳐서(감사합니다 ≡ ㅎ 등) 스마트
  // 모드에서 단어를 빼버린 적이 있습니다. 그 결과 기본 설정으로는 인사말이
  // 아예 인식되지 않았습니다. 지금은 겹치지 않는 손 모양으로 옮겨 해결했고,
  // 다시 겹치지 않도록 여기서 확인합니다.
  for (const rule of GESTURE_RULES.filter((r) => r.category === 'word')) {
    const hand = buildHandFromShape(rule.shape);
    // 스마트 모드는 "기대 자모 + 단어"를 후보로 둡니다. 자음 차례와 모음
    // 차례 양쪽에서 모두 인식되어야 언제 손을 들어도 동작합니다.
    const onConsonantTurn = classifyHand(hand, ['consonant', 'word']).label;
    const onVowelTurn = classifyHand(hand, ['vowel', 'word']).label;
    check(
      `단어 "${rule.label}" 가 스마트 모드 양쪽 차례에서 인식됨`,
      onConsonantTurn === rule.label && onVowelTurn === rule.label,
      true,
    );
  }

  // 사전 필터가 실제로 후보를 좁히는지
  const aRule = GESTURE_RULES.find((r) => r.label === 'ㅏ')!;
  const aHand = buildHandFromShape(aRule.shape);
  checkTrue(
    '같은 손 모양이라도 사전 범위에 따라 다르게 해석됨',
    classifyHand(aHand, ['vowel']).label === 'ㅏ' &&
      classifyHand(aHand, ['consonant']).label !== 'ㅏ',
  );

  // 신뢰도가 0~1 범위를 벗어나지 않는지
  const conf = classifyHand(fist, ['consonant']).confidence;
  checkTrue(`신뢰도가 0~1 범위 (${conf.toFixed(2)})`, conf >= 0 && conf <= 1);
}

// =============================================================================
// 3. 이펙트 감지기
// =============================================================================
section('3. 이펙트 감지기 (EffectGestureDetector)');
{
  const detector = new EffectGestureDetector();
  const fired: string[] = [];
  detector.events.on('enter', ({ id }) => fired.push(`enter:${id}`));
  detector.events.on('exit', ({ id }) => fired.push(`exit:${id}`));

  // 🕸️ 스파이더맨 손 모양: 엄지 + 검지 + 새끼
  const spiderHand = makeHand({
    thumb: true,
    index: true,
    middle: false,
    ring: false,
    pinky: true,
  });

  // 한 프레임만으로는 발동하지 않아야 합니다(떨림 방지).
  detector.update([spiderHand]);
  check('1프레임만으로는 발동하지 않음', fired.length, 0);

  // 연속으로 인식되면 발동합니다.
  detector.update([spiderHand]);
  detector.update([spiderHand]);
  check('3프레임 연속 → web 이펙트 발동', fired[0], 'enter:web');
  check('활성 이펙트가 web으로 기록됨', detector.getActive()?.id, 'web');

  // 손이 사라지면 잠시 버티다가 종료됩니다.
  for (let i = 0; i < 6; i++) detector.update([]);
  check('손이 사라지면 exit 이벤트 발생', fired[fired.length - 1], 'exit:web');
  check('활성 이펙트가 해제됨', detector.getActive(), null);

  // 다른 손 모양들도 올바른 이펙트로 이어지는지
  const cases: Array<[string, HandSpec, string]> = [
    ['주먹', { thumb: false, index: false, middle: false, ring: false, pinky: false }, 'energy'],
    ['다섯 손가락', { thumb: true, index: true, middle: true, ring: true, pinky: true }, 'fire'],
    ['브이', { thumb: false, index: true, middle: true, ring: false, pinky: false }, 'lightning'],
    ['검지만', { thumb: false, index: true, middle: false, ring: false, pinky: false }, 'sparkle'],
  ];

  for (const [name, spec, expectedId] of cases) {
    const d = new EffectGestureDetector();
    const hand = makeHand(spec);
    // 발동에 필요한 프레임 수만큼 반복합니다.
    for (let i = 0; i < 4; i++) d.update([hand]);
    check(`${name} → ${expectedId}`, d.getActive()?.id, expectedId);
  }
}

// =============================================================================
// 4. 양손 화면 전체 필살기
// =============================================================================
section('4. 양손 화면 전체 필살기 (화면 전체 이펙트)');
{
  // "같은 손 모양을 양손으로 하면 화면 전체로 승급"되는지 확인합니다.
  const upgrades: Array<[string, HandSpec, string]> = [
    ['양손 거미줄', { thumb: true, index: true, middle: false, ring: false, pinky: true }, 'webPrison'],
    ['양손 손바닥', { thumb: true, index: true, middle: true, ring: true, pinky: true }, 'inferno'],
    ['양손 브이', { thumb: false, index: true, middle: true, ring: false, pinky: false }, 'thunderstorm'],
    ['양손 검지', { thumb: false, index: true, middle: false, ring: false, pinky: false }, 'starstorm'],
    ['양손 주먹', { thumb: false, index: false, middle: false, ring: false, pinky: false }, 'quake'],
  ];

  for (const [name, spec, expectedId] of upgrades) {
    const detector = new EffectGestureDetector();
    const hand = makeHand(spec);
    // 두 번째 손은 화면 반대쪽에 두어 하트로 오인되지 않게 합니다.
    const otherHand = makeHand(spec).map((p) => ({ ...p, x: p.x + 0.35 }));
    for (let i = 0; i < 4; i++) detector.update([hand, otherHand]);
    check(`${name} → ${expectedId}`, detector.getActive()?.id, expectedId);
    checkTrue(`${expectedId} 는 화면 전체 이펙트로 분류됨`, isScreenWideEffect(expectedId as never));
  }

  // 한 손일 때는 승급되지 않아야 합니다.
  const single = new EffectGestureDetector();
  const fist = makeHand({ thumb: false, index: false, middle: false, ring: false, pinky: false });
  for (let i = 0; i < 4; i++) single.update([fist]);
  check('한 손 주먹은 승급 없이 energy 유지', single.getActive()?.id, 'energy');

  // 승급표에 있는 모든 대상이 실제로 화면 전체 이펙트인지
  const allUpgradesAreScreenWide = Object.values(TWO_HAND_UPGRADE).every(
    (id) => id !== undefined && isScreenWideEffect(id),
  );
  checkTrue('승급표의 모든 대상이 화면 전체 이펙트', allUpgradesAreScreenWide);
}

// =============================================================================
// 5. 손 모양 데이터 (이모지 대체 · 사전 페이지)
// =============================================================================
section('5. 손 모양 데이터 (사전 페이지에 필요)');
{
  // 모든 수어 규칙이 그림 데이터와 뜻을 갖고 있어야 사전 페이지가 완성됩니다.
  const missingShape = GESTURE_RULES.filter((r) => !r.shape || !r.shape.fingers);
  check('모든 수어 규칙에 손 모양 그림 데이터가 있음', missingShape.length, 0);

  const missingMeaning = GESTURE_RULES.filter((r) => !r.meaning || r.meaning.length < 2);
  check('모든 수어 규칙에 뜻 설명이 있음', missingMeaning.length, 0);

  const effects = getEffectCatalog();
  const effectsMissingShape = effects.filter((e) => !e.shape || !e.shape.fingers);
  check('모든 이펙트에 손 모양 그림 데이터가 있음', effectsMissingShape.length, 0);

  // 사전에 실릴 항목 수 (자음 10 + 모음 10 + 단어 5 + 이펙트 12)
  check('수어 규칙 개수', GESTURE_RULES.length, 25);
  check('이펙트 개수', effects.length, 12);

  // 화면 전체 이펙트는 모두 양손 그림이어야 합니다.
  const screenWideAreTwoHanded = effects
    .filter((e) => e.screenWide)
    .every((e) => e.shape.hands === 2);
  checkTrue('화면 전체 이펙트는 모두 양손 그림', screenWideAreTwoHanded);

  // 라벨 중복이 없어야 사전에서 헷갈리지 않습니다.
  const labels = GESTURE_RULES.map((r) => r.label);
  check('수어 라벨에 중복 없음', new Set(labels).size, labels.length);

  // --- 자료 신뢰도가 모든 규칙에 표시되어 있는지 ---
  const validConfidence = ['verified', 'inferred', 'invented'];
  const badConfidence = GESTURE_RULES.filter(
    (r) => !validConfidence.includes(r.confidence),
  );
  check('모든 규칙에 신뢰도가 표시됨', badConfidence.length, 0);

  const noRationale = GESTURE_RULES.filter((r) => !r.rationale || r.rationale.length < 10);
  check('모든 규칙에 근거 설명이 있음', noRationale.length, 0);

  // 근거 없는 손 모양('invented')은 반드시 출처가 "없음"으로 표시되어야 합니다.
  const inventedWithSource = GESTURE_RULES.filter(
    (r) => r.confidence === 'invented' && !r.source.includes('없음') && !r.source.includes('앱'),
  );
  check('임시 배정 항목은 출처를 사칭하지 않음', inventedWithSource.length, 0);

  // 단어 단축 동작은 전부 '임시 배정'이어야 합니다 (실제 수어가 아니므로).
  const wordsNotInvented = GESTURE_RULES.filter(
    (r) => r.category === 'word' && r.confidence !== 'invented',
  );
  check('단어 단축 동작은 모두 임시 배정으로 표시됨', wordsNotInvented.length, 0);

  // 이모지가 UI 데이터에 남아 있지 않은지 확인합니다.
  const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  const withEmoji = [
    ...GESTURE_RULES.map((r) => r.hint + r.meaning),
    ...effects.map((e) => e.hint + e.label),
  ].filter((text) => emojiPattern.test(text));
  check('안내 문구에 이모지가 없음', withEmoji.length, 0);
}

// =============================================================================
// 6. 수어 배우기 모드
// =============================================================================
section('6. 수어 배우기 모드 (커리큘럼 + 코치)');
{
  // --- 커리큘럼 무결성 ---
  // 레슨이 존재하지 않는 글자를 가리키면 연습 화면이 빈 채로 뜹니다.
  const allLabels = new Set(GESTURE_RULES.map((r) => r.label));
  const brokenTargets: string[] = [];
  for (const lesson of LESSONS) {
    for (const t of lesson.targets) {
      if (!allLabels.has(t)) brokenTargets.push(`${lesson.id}:${t}`);
    }
  }
  check(
    '모든 레슨이 실제로 존재하는 글자를 가리킴' +
      (brokenTargets.length ? ` (깨짐: ${brokenTargets.join(', ')})` : ''),
    brokenTargets.length,
    0,
  );

  // 첫 레슨은 반드시 읽기 전용이어야 합니다. 수어를 모르는 사람이 열자마자
  // 손 모양 연습부터 만나면 막힙니다.
  checkTrue('첫 레슨은 설명부터 시작함', LESSONS[0].targets.length === 0);
  checkTrue('첫 레슨에 설명 글이 있음', Boolean(LESSONS[0].intro));

  // 연습 레슨에는 요령이나 설명이 있어야 합니다.
  const practiceWithoutGuide = LESSONS.filter(
    (l) => l.targets.length > 0 && !l.tip && !l.intro,
  );
  check('모든 연습 레슨에 안내(요령 또는 설명)가 있음', practiceWithoutGuide.length, 0);

  // 자료로 확인된 ㅎ 가 첫 연습이어야 합니다(가장 믿을 수 있는 것부터).
  const firstPractice = LESSONS.find((l) => l.targets.length > 0);
  check('첫 연습 글자는 자료로 확인된 ㅎ', firstPractice?.targets[0], 'ㅎ');

  checkTrue('연습 단계가 20개 이상', totalPracticeSteps() >= 20);

  // --- 코치가 올바른 손을 통과시키는지 ---
  const coach = new CoachService();
  coach.setTarget('ㅎ');
  const hieutRule = GESTURE_RULES.find((r) => r.label === 'ㅎ')!;
  const correctHand = buildHandFromShape(hieutRule.shape);

  // 0.9초를 유지해야 통과합니다. 0.1초씩 12번이면 충분합니다.
  let passed = false;
  for (let i = 0; i < 12; i++) {
    passed = coach.update([correctHand], 0.1).passed;
  }
  checkTrue('올바른 손 모양을 유지하면 통과함', passed);

  // --- 한 프레임만으로는 통과하지 않아야 합니다 ---
  const quick = new CoachService();
  quick.setTarget('ㅎ');
  checkTrue(
    '한 프레임만으로는 통과하지 않음 (유지 시간 필요)',
    !quick.update([correctHand], 0.1).passed,
  );

  // --- 손이 없을 때 안내 ---
  const idle = new CoachService();
  idle.setTarget('ㅎ');
  const noHand = idle.update([], 0.1);
  checkTrue('손이 없으면 손을 보여달라고 안내함', noHand.hint.includes('손'));
  checkTrue(
    '손이 없으면 손가락 상태를 "모름"으로 표시함',
    noHand.fingers.thumb === 'unknown' && noHand.fingers.pinky === 'unknown',
  );

  // --- 구체적인 교정 안내를 주는지 (배우기 모드의 핵심) ---
  //
  // ㅎ(엄지만 펴기) 를 연습하는데 주먹을 쥐고 있으면
  // "엄지를 펴세요" 라고 콕 집어줘야 합니다.
  const wrongCoach = new CoachService();
  wrongCoach.setTarget('ㅎ');
  const fistShape = {
    fingers: { thumb: false, index: false, middle: false, ring: false, pinky: false },
  };
  const fistHand = buildHandFromShape(fistShape);
  const wrongFeedback = wrongCoach.update([fistHand], 0.1);
  checkTrue(
    `엄지를 펴야 한다고 콕 집어 알려줌 ("${wrongFeedback.hint}")`,
    wrongFeedback.hint.includes('엄지') && wrongFeedback.hint.includes('펴'),
  );
  check('엄지 상태가 "펴야 함"으로 표시됨', wrongFeedback.fingers.thumb, 'should-extend');

  // 반대로, 접어야 하는데 펴져 있으면 접으라고 해야 합니다.
  const curlCoach = new CoachService();
  curlCoach.setTarget('ㅎ');
  const openHandShape = {
    fingers: { thumb: true, index: true, middle: true, ring: true, pinky: true },
  };
  const openFeedback = curlCoach.update([buildHandFromShape(openHandShape)], 0.1);
  checkTrue(
    `접어야 할 손가락을 알려줌 ("${openFeedback.hint}")`,
    openFeedback.hint.includes('접'),
  );

  // --- 목표를 바꾸면 진행 상태가 초기화되는지 ---
  const switchCoach = new CoachService();
  switchCoach.setTarget('ㅎ');
  for (let i = 0; i < 12; i++) switchCoach.update([correctHand], 0.1);
  switchCoach.setTarget('ㅏ');
  checkTrue(
    '다른 글자로 바꾸면 진행 상태가 초기화됨',
    switchCoach.update([], 0.1).holdProgress === 0,
  );
}

// =============================================================================
// 결과 요약
// =============================================================================
console.log(`\n${'='.repeat(60)}`);
console.log(`통과 ${passed}개 / 실패 ${failed}개`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
