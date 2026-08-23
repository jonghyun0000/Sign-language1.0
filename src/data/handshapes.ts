// =============================================================================
// handshapes.ts — 한글 지문자(KMA)의 수형(手形) 목록
// =============================================================================
// 이 파일이 이 프로젝트에서 가장 중요합니다. 이전 버전은 제가 "구분하기 쉽게"
// 임의로 만든 손 모양을 썼는데, 그건 한국 지문자가 아니었습니다. 이제는
// 학술 자료에 실린 실제 수형 목록을 기반으로 합니다.
//
// 출처:
//   Simon Barnes-Sadler, "Hangul and the Korean Manual Alphabet",
//   카자흐스탄 한국학 2 (canks.asia). 손가락 번호는 논문의 표기를 따릅니다.
//     1지 = 엄지, 2지 = 검지, 3지 = 중지, 4지 = 약지, 5지 = 새끼
//   "digit이 언급되지 않으면 완전히 굽힌 것으로 본다"는 논문의 규칙을
//   그대로 적용했습니다.
//
// -----------------------------------------------------------------------------
// 이 조사에서 알게 된 중요한 사실들
// -----------------------------------------------------------------------------
// 1. 한글 자음 19개는 12개 수형으로, 모음 20개는 **단 5개 수형**으로 표현됩니다.
//    즉 모음은 손 모양이 아니라 **방향(orientation)으로 구분**됩니다.
//    실제로 모음 9개가 "검지만 편" 1형 하나를 공유합니다.
//
// 2. 자음은 한글 글자 모양을 본뜬 도상성(iconicity)이 강합니다.
//    반면 모음은 글자 모양과의 연관이 약합니다.
//
// 3. ㅆ만 유일하게 움직임이 있습니다(교차한 손가락을 펴는 동작).
//    정적 분류기로는 표현할 수 없어 이 프로젝트 범위 밖입니다.
//
// -----------------------------------------------------------------------------
// 아직 확인하지 못한 것 (매우 중요)
// -----------------------------------------------------------------------------
// 논문은 수형의 **정의**는 정확히 기술하지만, "어떤 글자가 어떤 수형을 쓰는지"
// 대응표는 한글 글자가 이미지로만 실려 있어 텍스트로 확보하지 못했습니다.
// 따라서 아래 GLYPH_HANDSHAPE 매핑 중 상당수는 **추정**입니다.
// 각 항목에 confidence를 명시했고, 앱 화면에도 그대로 표시됩니다.

import type { FingerSpec, ShapeDirection } from '../types';

/** 손가락 조합을 논문의 지 번호로 적기 위한 헬퍼. */
function digits(...extended: Array<1 | 2 | 3 | 4 | 5>): FingerSpec {
  const set = new Set(extended);
  return {
    thumb: set.has(1),
    index: set.has(2),
    middle: set.has(3),
    ring: set.has(4),
    pinky: set.has(5),
  };
}

/** 손가락 마디의 굽힘 상태 — 수형을 구분하는 핵심 요소입니다. */
export type KnuckleState =
  /** 두 마디 모두 폄 (논문의 "fully extended"). */
  | 'full'
  /** 첫마디만 펴고 둘째마디는 굽힘 (갈고리 모양). */
  | 'bent'
  /** 엄지와 만나 고리를 만듦. */
  | 'ring';

/** 수형 하나의 정의. */
export interface Handshape {
  /** 논문에 실린 이름. */
  id: string;
  /** 한국어 이름. */
  name: string;
  /** 펴는 손가락. */
  fingers: FingerSpec;
  /** 특별한 마디 상태 (없으면 전부 'full'). */
  knuckles?: Partial<Record<keyof FingerSpec, KnuckleState>>;
  /** 붙여야 하는 손가락들이 있는지. */
  pressedTogether?: boolean;
  /** 논문 원문 설명. */
  description: string;
}

// -----------------------------------------------------------------------------
// 자음에 쓰이는 12개 수형 (논문 Table 1)
// -----------------------------------------------------------------------------

export const CONSONANT_HANDSHAPES: Record<string, Handshape> = {
  /** 2형 — 자음 4글자가 사용. */
  h2: {
    id: '2hyeng',
    name: '2형',
    fingers: digits(2, 3),
    description: '2지와 3지를 완전히 폄 (검지 + 중지)',
  },
  /** 6형 — 자음 3글자가 사용. ㄱ/ㄴ처럼 ㄱ자 모양을 만듭니다. */
  h6: {
    id: '6hyeng',
    name: '6형',
    fingers: digits(1, 2),
    description: '1지와 2지를 완전히 폄 (엄지 + 검지)',
  },
  /** 7형 — 자음 2글자가 사용. */
  h7: {
    id: '7hyeng',
    name: '7형',
    fingers: digits(1, 2, 3),
    description: '1지, 2지, 3지를 완전히 폄 (엄지 + 검지 + 중지)',
  },
  /** 4형 붙임형 — 자음 2글자가 사용. */
  h4attached: {
    id: '4hyeng-buthim',
    name: '4형 붙임형',
    fingers: digits(2, 3, 4, 5),
    pressedTogether: true,
    description: '2~5지를 모두 펴되 서로 붙임 (네 손가락 모아 펴기)',
  },
  /** 3형 — 자음 1글자. */
  h3: {
    id: '3hyeng',
    name: '3형',
    fingers: digits(2, 3, 4),
    description: '2지, 3지, 4지를 완전히 폄 (검지 + 중지 + 약지)',
  },
  /** 2형 구부림형(20형) — 자음 1글자. */
  h2bent: {
    id: '2hyeng-kwuphim',
    name: '2형 구부림형(20형)',
    fingers: digits(2, 3),
    knuckles: { index: 'bent', middle: 'bent' },
    description: '2지와 3지를 첫마디만 펴고 둘째마디는 굽힘 (구부린 V)',
  },
  /** 8형 — 자음 1글자. */
  h8: {
    id: '8hyeng',
    name: '8형',
    fingers: digits(1, 2, 3, 4),
    description: '1~4지를 완전히 폄 (새끼만 접기)',
  },
  /** 7형 검지구부림형 — 자음 1글자. */
  h7indexBent: {
    id: '7hyeng-kemcikuphim',
    name: '7형 검지구부림형',
    fingers: digits(1, 2, 3),
    knuckles: { index: 'bent' },
    description: '1지와 3지는 완전히 펴고, 2지는 첫마디만 펴고 둘째마디는 굽힘',
  },
  /** 10형 — 자음 1글자. 엄지와 검지로 고리를 만듭니다. */
  h10: {
    id: '10hyeng',
    name: '10형',
    fingers: digits(3, 4, 5),
    knuckles: { thumb: 'ring', index: 'ring' },
    description: '1지와 2지로 고리를 만들고 나머지 3지·4지·5지는 완전히 폄',
  },
  /** 티읕형 — 자음 1글자. */
  hTikeut: {
    id: 'thikuth-hyeng',
    name: '티읕형',
    fingers: digits(2, 3, 4),
    pressedTogether: true,
    description: '2지, 3지, 4지를 펴되 3지와 4지를 서로 붙임',
  },
  /** 히읗형 — 자음 1글자. 이름 그대로 ㅎ에 대응할 가능성이 높습니다. */
  hHieut: {
    id: 'hiuh-hyeng',
    name: '히읗형',
    fingers: digits(1),
    description: '1지만 완전히 폄 (엄지만 세우기)',
  },
  /** 이름 없는 갈퀴형 — 자음 1글자. */
  hClaw: {
    id: 'claw',
    name: '갈퀴형',
    fingers: digits(2, 3, 4, 5),
    knuckles: { index: 'bent', middle: 'bent', ring: 'bent', pinky: 'bent' },
    description: '2~5지를 첫마디만 펴고 둘째마디는 굽힘 (갈퀴 모양)',
  },
};

// -----------------------------------------------------------------------------
// 모음에 쓰이는 5개 수형 (논문 Table 2)
// -----------------------------------------------------------------------------
// 핵심: 모음 20개가 이 5개만으로 표현됩니다. 나머지는 전부 방향으로 구분합니다.
// 특히 1형 하나가 모음 9개를 담당합니다.

export const VOWEL_HANDSHAPES: Record<string, Handshape> = {
  /** 1형 — 모음 9글자가 사용 (가장 많이 쓰임). */
  v1: {
    id: '1hyeng',
    name: '1형',
    fingers: digits(2),
    description: '2지만 완전히 폄 (검지만 펴기)',
  },
  /** 2형 — 모음 4글자. 자음과 공유하는 유일한 수형입니다. */
  v2: {
    id: '2hyeng',
    name: '2형',
    fingers: digits(2, 3),
    description: '2지와 3지를 완전히 폄 (검지 + 중지)',
  },
  /** 여우형 — 모음 7글자. */
  vYewu: {
    id: 'yewuhyeng',
    name: '여우형',
    fingers: digits(2, 5),
    description: '2지와 5지를 완전히 폄 (검지 + 새끼)',
  },
  /** 제비형 — 모음 2글자. */
  vCeypi: {
    id: 'ceypihyeng',
    name: '제비형',
    fingers: digits(2, 3, 5),
    description: '2지, 3지, 5지를 완전히 폄 (검지 + 중지 + 새끼)',
  },
  /** 여자형 — 모음 1글자. */
  vYeca: {
    id: 'yecahyeng',
    name: '여자형',
    fingers: digits(5),
    description: '5지만 완전히 폄 (새끼만 펴기)',
  },
};

// -----------------------------------------------------------------------------
// 신뢰도 표시
// -----------------------------------------------------------------------------

/**
 * 이 손 모양을 얼마나 믿을 수 있는가.
 *
 *   verified — 자료에서 직접 확인함
 *   inferred — 검증된 수형 목록 + 도상성(글자 모양 닮음) 원리로 추정
 *   invented — 아직 근거 없음. 이 앱 안에서만 통하는 임시 배정
 *
 * 이 값은 앱 화면에 그대로 표시됩니다. 사용자가 "이건 진짜 지문자"와
 * "이건 아직 확인 안 된 것"을 구분할 수 있어야 하기 때문입니다.
 */
export type Confidence = 'verified' | 'inferred' | 'invented';

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  verified: '자료 확인됨',
  inferred: '추정',
  invented: '임시 배정',
};

export const CONFIDENCE_NOTE: Record<Confidence, string> = {
  verified: '학술 자료에서 손 모양을 직접 확인했습니다.',
  inferred:
    '검증된 수형 목록에 있는 손 모양이지만, 이 글자에 대응하는지는 아직 확인하지 못했습니다.',
  invented:
    '아직 근거가 없는 임시 손 모양입니다. 실제 지문자와 다를 수 있으니 학습용으로 쓰지 마세요.',
};

/** 자료 출처 표기. */
export const SOURCES = {
  barnesSadler:
    'Barnes-Sadler, "Hangul and the Korean Manual Alphabet", 카자흐스탄 한국학 2',
  none: '출처 없음 (이 앱의 임시 배정)',
} as const;

/** 방향까지 포함한 완성된 지문자 정의. */
export interface FingerspellingEntry {
  /** 어떤 수형을 쓰는가. */
  handshape: Handshape;
  /** 손이 향하는 방향 (모음 구분의 핵심). */
  direction?: ShapeDirection;
  confidence: Confidence;
  source: string;
  /** 왜 이렇게 정했는지 — 나중에 검증할 사람을 위한 메모. */
  rationale: string;
}
