// =============================================================================
// 한국 지문자 제스처 데이터셋
// =============================================================================
// ⚠️ 이 파일은 한 번 전면 재작성되었습니다.
//
// 이전 버전은 제가 "서로 구분하기 쉽도록" **직접 만들어낸** 손 모양을 썼습니다.
// 그건 한국 지문자가 아니었고, 농인이 쓸 수도 없고 배우는 사람에게는 오히려
// 해로웠습니다. 지금 버전은 학술 자료에 실린 **실제 수형 목록**(handshapes.ts)
// 위에 세워져 있습니다.
//
// -----------------------------------------------------------------------------
// 조사로 바뀐 설계
// -----------------------------------------------------------------------------
// 1. 모음은 손 모양이 아니라 **방향**으로 구분됩니다.
//    실제 지문자는 모음 20개를 단 5개 수형으로 표현하고, 그중 1형(검지만 폄)
//    하나가 모음 9개를 담당합니다. 이전 버전에서 방향을 쓴 것은 우연히
//    구조적으로 맞았지만, 근거를 몰랐습니다.
//
// 2. 자음도 같은 수형을 방향으로 나눠 씁니다.
//    6형(엄지+검지)은 자음 3글자가, 2형(검지+중지)은 4글자가 공유합니다.
//    따라서 ㄱ/ㄴ, ㄷ/ㅅ 처럼 손 모양이 같고 방향만 다른 쌍이 생깁니다.
//    → 인식 난이도가 올라갑니다. 이건 정확성을 위해 감수한 대가입니다.
//
// 3. 각 글자마다 **신뢰도**를 붙였습니다.
//    수형 목록은 확보했지만 "어떤 글자가 어떤 수형을 쓰는지" 대응표는
//    한글이 이미지로만 실려 있어 확보하지 못했습니다. 그래서 대부분이
//    '추정'입니다. 이 값은 앱 화면에 그대로 표시됩니다.

import type {
  GestureCategory,
  GestureShape,
  GesturePrediction,
  HandLandmarks,
} from '../types';
import {
  CONSONANT_HANDSHAPES as C,
  VOWEL_HANDSHAPES as V,
  SOURCES,
  type Confidence,
  type Handshape,
} from './handshapes';
import {
  LM,
  type Direction4,
  directionScore,
  distance2D,
  getFingerState,
  getFingerFlexions,
  handSize,
  indexDirection,
  indexStraightness,
  fingerDirection,
  handDirection,
  horizontality,
  jointAngle,
  thumbIndexPinch,
} from '../utils/landmarkUtils';

/** 제스처 규칙 하나. */
export interface GestureRule {
  /** 인식되었을 때 출력할 한글 자모 또는 단어. */
  label: string;
  category: Exclude<GestureCategory, 'none'>;
  /** 손 모양 설명. */
  hint: string;
  /** 그림을 그리기 위한 데이터. */
  shape: GestureShape;
  /** 사전 페이지에 보여줄 뜻. */
  meaning: string;
  /** 이 손 모양을 얼마나 믿을 수 있는가. 화면에 표시됩니다. */
  confidence: Confidence;
  /** 자료 출처. */
  source: string;
  /** 왜 이렇게 정했는지 — 나중에 검증할 사람을 위한 메모. */
  rationale: string;
  /** 사용하는 수형 이름 (사전 페이지 표시용). */
  handshapeName?: string;
  /** 0~1 점수. */
  score: (lm: HandLandmarks) => number;
}

// -----------------------------------------------------------------------------
// 점수 계산 헬퍼
// -----------------------------------------------------------------------------

const b = (x: boolean) => (x ? 1 : 0);

/** 지정한 손가락 중 몇 개가 기대와 맞는지 (0~1). */
function fingerPatternScore(
  actual: ReturnType<typeof getFingerState>,
  expected: Partial<ReturnType<typeof getFingerState>>,
): number {
  let matched = 0;
  let checked = 0;
  for (const key of ['thumb', 'index', 'middle', 'ring', 'pinky'] as const) {
    if (expected[key] === undefined) continue;
    checked += 1;
    if (actual[key] === expected[key]) matched += 1;
  }
  return checked === 0 ? 0 : matched / checked;
}

/**
 * 수형이 요구하는 손가락 조합과 얼마나 맞는지.
 *
 * 굽힘 3단계를 씁니다. 이전에는 "폈다/접었다" 두 단계뿐이라, 갈퀴형처럼
 * "첫마디만 편" 손가락이 접힌 것으로 잘못 읽혀 ㅁ이 아예 인식되지
 * 않았습니다(혼동 행렬 테스트에서 발견).
 */
function handshapeScore(lm: HandLandmarks, hs: Handshape): number {
  const flex = getFingerFlexions(lm);
  let matched = 0;
  const keys = ['thumb', 'index', 'middle', 'ring', 'pinky'] as const;

  for (const key of keys) {
    const wantExtended = hs.fingers[key];
    const want = hs.knuckles?.[key];
    const actual = flex[key];

    if (!wantExtended) {
      // 접혀 있어야 하는 손가락.
      if (actual === 'curled') matched += 1;
      // 살짝 굽은 정도는 절반만 인정합니다.
      else if (actual === 'bent') matched += 0.4;
      continue;
    }

    // 펴야 하는 손가락.
    if (want === 'bent' || want === 'ring') {
      // 첫마디만 펴는 수형: bent 가 정답, extended 도 어느 정도 인정.
      if (actual === 'bent') matched += 1;
      else if (actual === 'extended') matched += 0.6;
    } else {
      if (actual === 'extended') matched += 1;
      else if (actual === 'bent') matched += 0.5;
    }
  }
  return matched / keys.length;
}

/** 검지와 중지 손끝 사이 간격 (손 크기로 정규화). */
function indexMiddleGap(lm: HandLandmarks): number {
  return distance2D(lm[LM.INDEX_TIP], lm[LM.MIDDLE_TIP]) / handSize(lm);
}

/** 손가락들이 서로 붙어 있는 정도 (0~1). 붙임형 판별용. */
function togetherness(lm: HandLandmarks): number {
  const gap = indexMiddleGap(lm);
  return gap < 0.3 ? 1 : Math.max(0, 1 - (gap - 0.3) * 3);
}

/** 중지가 곧게 펴진 정도 (0~1). 구부림형 판별용. */
function middleStraightness(lm: HandLandmarks): number {
  const angle = jointAngle(lm, LM.MIDDLE_MCP, LM.MIDDLE_PIP, LM.MIDDLE_TIP);
  return Math.min(1, Math.max(0, (angle - 130) / 40));
}

/**
 * 수형 + 방향으로 이루어진 지문자 규칙을 만듭니다.
 *
 * 실제 지문자가 "적은 수형 + 방향"으로 이루어져 있으므로, 대부분의 글자를
 * 이 헬퍼 하나로 표현할 수 있습니다.
 */
function fingerspelling(opts: {
  label: string;
  category: 'consonant' | 'vowel';
  handshape: Handshape;
  direction?: Direction4;
  meaning: string;
  hint: string;
  confidence: Confidence;
  rationale: string;
  /** 방향 판정에 쓸 손가락 (기본 검지). 새끼만 펴는 수형은 새끼를 봅니다. */
  directionFinger?: 'index' | 'pinky' | 'thumb' | 'hand';
  /** 손 모양 그림에 넘길 추가 정보. */
  shapeExtra?: Partial<GestureShape>;
  /** 점수에 추가로 곱하거나 더할 조건. */
  extraScore?: (lm: HandLandmarks) => number;
}): GestureRule {
  const {
    label,
    category,
    handshape,
    direction,
    meaning,
    hint,
    confidence,
    rationale,
    directionFinger = 'index',
    shapeExtra = {},
    extraScore,
  } = opts;

  return {
    label,
    category,
    hint,
    meaning,
    confidence,
    source: confidence === 'invented' ? SOURCES.none : SOURCES.barnesSadler,
    rationale,
    handshapeName: handshape.name,
    shape: {
      fingers: handshape.fingers,
      direction,
      ...shapeExtra,
    },
    score: (lm) => {
      // 1) 손가락 조합이 수형과 맞는가 (가장 중요)
      const shapeMatch = handshapeScore(lm, handshape);

      // 2) 방향이 맞는가 (모음과 동형 자음을 가르는 핵심)
      let dirMatch = 1;
      if (direction) {
        const vec =
          directionFinger === 'pinky'
            ? fingerDirection(lm, LM.PINKY_MCP, LM.PINKY_TIP)
            : directionFinger === 'thumb'
              ? fingerDirection(lm, LM.THUMB_MCP, LM.THUMB_TIP)
              : directionFinger === 'hand'
                ? handDirection(lm)
                : indexDirection(lm);
        dirMatch = directionScore(vec, direction);
      }

      // 3) 수형별 추가 조건 (붙임, 구부림 등)
      const extra = extraScore ? extraScore(lm) : 1;

      // 방향이 있는 글자는 방향 비중을 크게 둡니다. 그래야 같은 수형끼리
      // 구분됩니다.
      const base = direction
        ? shapeMatch * 0.55 + dirMatch * 0.45
        : shapeMatch;
      return base * extra;
    },
  };
}

// =============================================================================
// 자음
// =============================================================================
// 모두 handshapes.ts 의 검증된 수형을 씁니다.
// 글자↔수형 대응은 대부분 도상성(글자 모양 닮음)에 근거한 추정입니다.

const CONSONANT_RULES: GestureRule[] = [
  fingerspelling({
    label: 'ㄱ',
    category: 'consonant',
    handshape: C.h6,
    direction: 'left',
    hint: '엄지와 검지로 ㄱ자 만들기 (검지가 왼쪽을 향함)',
    meaning: "기역. '가·구·국'의 첫소리",
    confidence: 'inferred',
    rationale:
      '6형(엄지+검지)은 자음 3글자가 공유합니다. 엄지와 검지가 이루는 직각이 ㄱ의 글자 모양과 일치해 6형으로 추정했습니다. ' +
      '다만 일부 국내 자료는 ㄱ을 "엄지+새끼"로 설명해 자료 간 차이가 있습니다. 검증 필요.',
  }),
  fingerspelling({
    label: 'ㄴ',
    category: 'consonant',
    handshape: C.h6,
    direction: 'right',
    hint: '엄지와 검지로 ㄴ자 만들기 (검지가 오른쪽을 향함)',
    meaning: "니은. '나·누·눈'의 첫소리",
    confidence: 'inferred',
    rationale:
      'ㄱ과 같은 6형을 쓰되 방향이 반대입니다. 논문이 "일부 글자는 방향으로만 구분된다"고 밝힌 것과 부합합니다.',
  }),
  fingerspelling({
    label: 'ㄷ',
    category: 'consonant',
    handshape: C.h2,
    direction: 'left',
    hint: '검지와 중지를 붙여 옆으로 (ㄷ의 두 가로획)',
    meaning: "디귿. '다·도·달'의 첫소리",
    confidence: 'inferred',
    rationale:
      'ㄷ의 가로획 2개 = 손가락 2개(2형). ㅌ(가로획 3개)이 티읕형(손가락 3개)인 것과 같은 원리로 추정했습니다.',
    shapeExtra: { spread: 'narrow' },
    extraScore: (lm) => 0.6 + togetherness(lm) * 0.4,
  }),
  fingerspelling({
    label: 'ㄹ',
    category: 'consonant',
    handshape: C.h3,
    hint: '검지·중지·약지 세 손가락 펴기',
    meaning: "리을. '라·리·물'의 소리",
    confidence: 'inferred',
    rationale:
      '3형(검지+중지+약지)은 자음 1글자만 씁니다. ㄹ의 가로획 3개와 손가락 3개를 대응시켰습니다.',
  }),
  fingerspelling({
    label: 'ㅁ',
    category: 'consonant',
    handshape: C.hClaw,
    hint: '네 손가락을 갈퀴처럼 굽혀 네모 만들기',
    meaning: "미음. '마·문·감'의 소리",
    confidence: 'inferred',
    rationale:
      '갈퀴형(2~5지를 첫마디만 폄)은 자음 1글자만 씁니다. 굽힌 손가락이 만드는 네모가 ㅁ과 닮아 대응시켰습니다.',
    shapeExtra: { claw: true },
    // 굽힘 3단계 판별이 갈퀴 상태를 직접 인식하므로 별도 보정이 필요 없습니다.
  }),
  fingerspelling({
    label: 'ㅂ',
    category: 'consonant',
    handshape: C.h4attached,
    direction: 'up',
    hint: '네 손가락을 붙여서 위로 펴기',
    meaning: "비읍. '바·부·밥'의 소리",
    confidence: 'inferred',
    rationale:
      '4형 붙임형(2~5지를 붙여서 폄)은 자음 2글자가 씁니다. 위로 뻗은 네 손가락이 ㅂ의 세로획과 닮아 대응시켰습니다.',
    shapeExtra: { spread: 'narrow' },
    extraScore: (lm) => 0.7 + togetherness(lm) * 0.3,
  }),
  fingerspelling({
    label: 'ㅅ',
    category: 'consonant',
    handshape: C.h2,
    direction: 'down',
    hint: '검지와 중지를 벌려 아래로 (사람 다리 모양)',
    meaning: "시옷. '사·수·손'의 첫소리",
    confidence: 'inferred',
    rationale:
      'ㄷ과 같은 2형이지만 아래를 향하고 벌립니다. 벌어진 두 손가락이 ㅅ의 두 획과 정확히 닮았습니다.',
    shapeExtra: { spread: 'wide' },
    extraScore: (lm) => {
      const gap = indexMiddleGap(lm);
      const spread = gap > 0.45 ? 1 : Math.max(0, gap / 0.45);
      return 0.55 + spread * 0.45;
    },
  }),
  fingerspelling({
    label: 'ㅇ',
    category: 'consonant',
    handshape: C.h10,
    hint: '엄지와 검지로 동그라미, 나머지 세 손가락은 펴기',
    meaning: '이응. 받침으로 쓰이거나 소리 없는 첫소리',
    confidence: 'inferred',
    rationale:
      '10형(엄지+검지로 고리, 나머지 폄)은 자음 1글자만 씁니다. 고리 = 동그라미 = ㅇ 으로 대응시켰습니다. ' +
      '다만 일부 국내 자료는 "엄지+새끼로 고리"라고 설명해 차이가 있습니다. 검증 필요.',
    shapeExtra: { pinch: 'index' },
    extraScore: (lm) => 0.35 + b(thumbIndexPinch(lm)) * 0.65,
  }),
  fingerspelling({
    label: 'ㅈ',
    category: 'consonant',
    handshape: C.h7,
    hint: '엄지·검지·중지 세 손가락 펴기',
    meaning: "지읒. '자·주·집'의 첫소리",
    confidence: 'inferred',
    rationale:
      '7형(엄지+검지+중지)은 자음 2글자가 씁니다. ㅈ은 ㅅ에 획을 하나 더한 글자이고, 7형도 2형에 엄지를 더한 모양이라 대응시켰습니다.',
  }),
  fingerspelling({
    label: 'ㅎ',
    category: 'consonant',
    handshape: C.hHieut,
    direction: 'up',
    hint: '엄지만 위로 세우기',
    meaning: "히읗. '하·호·학'의 첫소리",
    confidence: 'verified',
    rationale:
      '수형 이름 자체가 "히읗형"이고 정의가 "1지만 완전히 폄"입니다. 이 프로젝트에서 유일하게 자료로 직접 확인된 대응입니다.',
    directionFinger: 'thumb',
  }),
];

// =============================================================================
// 모음
// =============================================================================
// 실제 지문자에서 모음은 "적은 수형 + 방향"으로 구분됩니다.
// 1형(검지만) 하나가 모음 9개를, 2형이 4개를 담당합니다.

const VOWEL_RULES: GestureRule[] = [
  // --- 1형 (검지만) + 방향 : 기본 모음 ---
  fingerspelling({
    label: 'ㅏ',
    category: 'vowel',
    handshape: V.v1,
    direction: 'right',
    hint: '검지를 곧게 펴서 오른쪽',
    meaning: "'아' 소리. 가·나·다의 모음",
    confidence: 'inferred',
    rationale:
      '1형(검지만)은 모음 9개가 공유하며 방향으로 구분됩니다. ㅏ는 세로획 오른쪽에 획이 붙으므로 오른쪽으로 추정했습니다.',
    extraScore: (lm) => 0.6 + indexStraightness(lm) * 0.4,
  }),
  fingerspelling({
    label: 'ㅓ',
    category: 'vowel',
    handshape: V.v1,
    direction: 'left',
    hint: '검지를 곧게 펴서 왼쪽',
    meaning: "'어' 소리. 머리·서울의 모음",
    confidence: 'inferred',
    rationale: 'ㅏ의 거울상. 획이 왼쪽에 붙는 글자 모양을 따랐습니다.',
    extraScore: (lm) => 0.6 + indexStraightness(lm) * 0.4,
  }),
  fingerspelling({
    label: 'ㅗ',
    category: 'vowel',
    handshape: V.v1,
    direction: 'up',
    hint: '검지를 곧게 펴서 위쪽',
    meaning: "'오' 소리. 오리·소리의 모음",
    confidence: 'inferred',
    rationale: 'ㅗ는 가로획 위에 획이 붙으므로 위쪽으로 추정했습니다.',
    extraScore: (lm) => 0.6 + indexStraightness(lm) * 0.4,
  }),
  fingerspelling({
    label: 'ㅜ',
    category: 'vowel',
    handshape: V.v1,
    direction: 'down',
    hint: '검지를 곧게 펴서 아래쪽',
    meaning: "'우' 소리. 구름·수박의 모음",
    confidence: 'inferred',
    rationale: 'ㅗ의 거울상. 획이 아래에 붙는 글자 모양을 따랐습니다.',
    extraScore: (lm) => 0.6 + indexStraightness(lm) * 0.4,
  }),

  // --- 2형 (검지+중지) + 방향 : 이중모음 ---
  // 논문에서 2형이 담당하는 모음이 정확히 4개인데, 이중모음 ㅑㅕㅛㅠ 도 4개라
  // 대응 가능성이 높습니다.
  fingerspelling({
    label: 'ㅑ',
    category: 'vowel',
    handshape: V.v2,
    direction: 'right',
    hint: '검지+중지를 오른쪽으로',
    meaning: "'야' 소리. ㅏ에 획을 더한 이중모음",
    confidence: 'inferred',
    rationale:
      '2형은 모음 정확히 4개가 사용합니다. 이중모음도 정확히 4개(ㅑㅕㅛㅠ)이고, "획을 하나 더한다 = 손가락을 하나 더 편다"는 원리와 맞아 대응시켰습니다.',
    extraScore: (lm) => 0.7 + middleStraightness(lm) * 0.3,
  }),
  fingerspelling({
    label: 'ㅕ',
    category: 'vowel',
    handshape: V.v2,
    direction: 'left',
    hint: '검지+중지를 왼쪽으로',
    meaning: "'여' 소리. ㅓ에 획을 더한 이중모음",
    confidence: 'inferred',
    rationale: 'ㅑ와 같은 2형, 방향만 반대입니다.',
    extraScore: (lm) => 0.7 + middleStraightness(lm) * 0.3,
  }),
  fingerspelling({
    label: 'ㅛ',
    category: 'vowel',
    handshape: V.v2,
    direction: 'up',
    hint: '검지+중지를 위쪽으로',
    meaning: "'요' 소리. ㅗ에 획을 더한 이중모음",
    confidence: 'inferred',
    rationale: 'ㅗ의 이중모음이므로 같은 위쪽 방향에 손가락을 하나 더했습니다.',
    extraScore: (lm) => 0.7 + middleStraightness(lm) * 0.3,
  }),
  fingerspelling({
    label: 'ㅠ',
    category: 'vowel',
    handshape: V.v2,
    direction: 'down',
    hint: '검지+중지를 아래쪽으로',
    meaning: "'유' 소리. ㅜ에 획을 더한 이중모음",
    confidence: 'inferred',
    rationale: 'ㅜ의 이중모음이므로 같은 아래쪽 방향에 손가락을 하나 더했습니다.',
    extraScore: (lm) => 0.7 + middleStraightness(lm) * 0.3,
  }),

  // --- 나머지 ---
  fingerspelling({
    label: 'ㅡ',
    category: 'vowel',
    handshape: V.vYewu,
    direction: 'right',
    hint: '검지와 새끼를 펴서 옆으로 눕히기',
    meaning: "'으' 소리. 그림·느낌의 모음",
    confidence: 'invented',
    rationale:
      '여우형(검지+새끼)이 모음 7개를 담당한다는 것까지만 확인했고, 그중 ㅡ가 포함되는지는 모릅니다. ' +
      '1형은 이미 ㅏㅓㅗㅜ가 차지해 남은 수형 중 하나를 임시로 배정했습니다. 실제 지문자와 다를 가능성이 큽니다.',
    extraScore: (lm) => 0.6 + horizontality(indexDirection(lm)) * 0.4,
  }),
  fingerspelling({
    label: 'ㅣ',
    category: 'vowel',
    handshape: V.vYeca,
    direction: 'up',
    hint: '새끼손가락만 위로 세우기',
    meaning: "'이' 소리. 기린·시계의 모음",
    confidence: 'inferred',
    rationale:
      '여자형(새끼만 폄)은 모음 정확히 1개만 사용합니다. ㅣ는 획이 하나뿐인 가장 단순한 모음이라 대응 가능성이 높습니다.',
    directionFinger: 'pinky',
  }),
];

// =============================================================================
// 단어 / 인사말
// =============================================================================
// ⚠️ 이 항목들은 지문자도 아니고 실제 한국수어도 아닙니다.
//
// 실제 한국수어의 단어는 대부분 **움직임**을 포함하고 양손을 쓰며, 얼굴 표정도
// 문법의 일부입니다. 정지된 손 모양 하나로는 표현할 수 없습니다.
// 아래는 이 앱에서 빠르게 문장을 넣기 위한 **단축키**일 뿐이며, 전부
// 'invented'로 표시됩니다.

function shortcut(opts: {
  label: string;
  fingers: GestureShape['fingers'];
  hint: string;
  meaning: string;
  direction?: Direction4;
  shapeExtra?: Partial<GestureShape>;
  score: (lm: HandLandmarks) => number;
}): GestureRule {
  return {
    label: opts.label,
    category: 'word',
    hint: opts.hint,
    meaning: opts.meaning,
    confidence: 'invented',
    source: SOURCES.none,
    rationale:
      '실제 한국수어 단어가 아닙니다. 한국수어의 단어는 움직임과 양손, 표정을 함께 씁니다. ' +
      '이건 문장을 빠르게 입력하기 위한 이 앱만의 단축 동작입니다.',
    shape: { fingers: opts.fingers, direction: opts.direction, ...opts.shapeExtra },
    score: opts.score,
  };
}

const WORD_RULES: GestureRule[] = [
  shortcut({
    label: '안녕하세요',
    fingers: { thumb: true, index: true, middle: true, ring: true, pinky: true },
    direction: 'up',
    hint: '다섯 손가락 모두 펴서 손바닥 보이기',
    meaning: '만났을 때 하는 인사',
    score: (lm) => {
      const pattern = fingerPatternScore(getFingerState(lm), {
        thumb: true,
        index: true,
        middle: true,
        ring: true,
        pinky: true,
      });
      return pattern * 0.75 + directionScore(handDirection(lm), 'up') * 0.25;
    },
  }),
  shortcut({
    label: '감사합니다',
    fingers: { thumb: true, index: false, middle: false, ring: false, pinky: false },
    direction: 'up',
    hint: '엄지 척 (엄지만 위로)',
    meaning: '고마움을 전할 때',
    score: (lm) => {
      // 주의: ㅎ(히읗형)과 손 모양이 같습니다. 사전 모드로 구분해야 합니다.
      const pattern = fingerPatternScore(getFingerState(lm), {
        thumb: true,
        index: false,
        middle: false,
        ring: false,
        pinky: false,
      });
      const up = directionScore(
        fingerDirection(lm, LM.THUMB_MCP, LM.THUMB_TIP),
        'up',
      );
      return pattern * 0.65 + up * 0.35;
    },
  }),
  shortcut({
    label: '사랑합니다',
    fingers: { thumb: true, index: true, middle: false, ring: false, pinky: true },
    hint: '엄지·검지·새끼 펴기 (I Love You)',
    meaning: '애정을 표현할 때',
    score: (lm) =>
      fingerPatternScore(getFingerState(lm), {
        thumb: true,
        index: true,
        middle: false,
        ring: false,
        pinky: true,
      }),
  }),
  shortcut({
    label: '도와주세요',
    fingers: { thumb: false, index: true, middle: false, ring: false, pinky: false },
    direction: 'up',
    hint: '검지를 곧게 위로 세우기',
    meaning: '도움을 요청할 때',
    score: (lm) => {
      // 주의: 모음 ㅗ와 손 모양·방향이 같습니다.
      const pattern = fingerPatternScore(getFingerState(lm), {
        thumb: false,
        index: true,
        middle: false,
        ring: false,
        pinky: false,
      });
      return (
        pattern * 0.4 +
        directionScore(indexDirection(lm), 'up') * 0.4 +
        indexStraightness(lm) * 0.2
      );
    },
  }),
  shortcut({
    label: '괜찮아요',
    fingers: { thumb: false, index: false, middle: true, ring: true, pinky: true },
    hint: 'OK 사인 (동그라미 + 세 손가락 펴기)',
    meaning: '문제없다고 답할 때',
    shapeExtra: { pinch: 'index' },
    score: (lm) => {
      // 주의: ㅇ(10형)과 사실상 같은 손 모양입니다.
      const f = getFingerState(lm);
      const pinched = b(thumbIndexPinch(lm));
      const others = f.middle && f.ring && f.pinky ? 1 : 0;
      return pinched * 0.5 + others * 0.5;
    },
  }),
];

/** 전체 규칙. */
export const GESTURE_RULES: GestureRule[] = [
  ...CONSONANT_RULES,
  ...VOWEL_RULES,
  ...WORD_RULES,
];

/** 카테고리별 규칙. */
export function getRulesByCategory(
  category: Exclude<GestureCategory, 'none'>,
): GestureRule[] {
  return GESTURE_RULES.filter((r) => r.category === category);
}

/**
 * 손을 분류합니다.
 *
 * @param lm       손 랜드마크 21개
 * @param allowed  후보로 볼 카테고리 (사전 모드가 결정)
 * @param minScore 이 점수 미만이면 인식 실패
 */
export function classifyHand(
  lm: HandLandmarks,
  allowed?: ReadonlyArray<Exclude<GestureCategory, 'none'>>,
  minScore = 0.5,
): GesturePrediction {
  let best: GestureRule | null = null;
  let bestScore = 0;

  for (const rule of GESTURE_RULES) {
    if (allowed && !allowed.includes(rule.category)) continue;
    const s = rule.score(lm);
    if (s > bestScore) {
      bestScore = s;
      best = rule;
    }
  }

  if (!best || bestScore < minScore) {
    return { label: null, confidence: bestScore, category: 'none' };
  }
  return { label: best.label, confidence: bestScore, category: best.category };
}

/** 라벨로 규칙 찾기 (사전 페이지용). */
export function getRuleByLabel(label: string): GestureRule | undefined {
  return GESTURE_RULES.find((r) => r.label === label);
}

export function getKnownLabels(): string[] {
  return GESTURE_RULES.map((r) => r.label);
}

export { extendedFingerCount } from '../utils/landmarkUtils';
