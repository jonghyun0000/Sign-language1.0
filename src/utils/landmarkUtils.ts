// =============================================================================
// 랜드마크 수학 헬퍼 (Landmark math helpers)
// =============================================================================
// MediaPipe Hands는 손 하나당 21개의 랜드마크를 줍니다. 아래 인덱스는 공식
// 문서 기준이며 버전이 바뀌어도 동일합니다.
//
//   0: 손목(wrist)
//   1-4:   엄지 (CMC, MCP, IP, TIP)
//   5-8:   검지 (MCP, PIP, DIP, TIP)
//   9-12:  중지
//   13-16: 약지
//   17-20: 새끼
//
// 모든 함수는 정규화 좌표(0~1)를 사용합니다. 픽셀 크기와 무관하므로 카메라
// 해상도가 달라져도 분류기가 그대로 동작합니다.

import type { HandLandmarks, Landmark } from '../types';

/** 이름으로 참조하는 랜드마크 인덱스 (분류기 코드 가독성용). */
export const LM = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_DIP: 11,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
} as const;

// -----------------------------------------------------------------------------
// 거리 / 크기
// -----------------------------------------------------------------------------

/** 2D 유클리드 거리 (z는 노이즈가 커서 제외). */
export function distance2D(a: Landmark, b: Landmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** 3D 거리 — 깊이가 중요할 때만 사용. */
export function distance3D(a: Landmark, b: Landmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * 손 크기 추정 — 손목에서 중지 MCP 관절까지의 거리.
 * 다른 거리를 이 값으로 나누면 "손이 가까이 있든 멀리 있든" 비슷한 비율이
 * 나오므로 거리에 강인한 규칙을 만들 수 있습니다.
 */
export function handSize(lm: HandLandmarks): number {
  return distance2D(lm[LM.WRIST], lm[LM.MIDDLE_MCP]) || 1e-6;
}

/** 손바닥 중심 (손목 + 4개 MCP의 평균). 이펙트 시작점으로 좋습니다. */
export function palmCenter(lm: HandLandmarks): Landmark {
  const pts = [
    lm[LM.WRIST],
    lm[LM.INDEX_MCP],
    lm[LM.MIDDLE_MCP],
    lm[LM.RING_MCP],
    lm[LM.PINKY_MCP],
  ];
  const n = pts.length;
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / n,
    y: pts.reduce((s, p) => s + p.y, 0) / n,
    z: pts.reduce((s, p) => s + p.z, 0) / n,
  };
}

// -----------------------------------------------------------------------------
// 손가락 폄/굽힘 판별
// -----------------------------------------------------------------------------

/**
 * (엄지 제외) 손가락이 펴져 있는가?
 *
 * ⚠️ 이 함수는 한 번 고쳐졌습니다. 예전에는 "손끝이 PIP보다 **손목**에서
 * 먼가"로 판단했는데, 그러면 **아래를 향한 손가락**이 항상 접힌 것으로
 * 읽힙니다. 손가락을 아래로 뻗으면 손끝이 손목 쪽으로 내려오기 때문입니다.
 * 그 결과 ㅅ, ㅜ, ㅠ 처럼 아래를 향하는 글자가 구조적으로 인식 불가였습니다.
 * (혼동 행렬 테스트로 발견)
 *
 * 지금은 **MCP(손가락 뿌리 관절)** 기준으로 잽니다. 손가락이 어느 방향을
 * 향하든 "뿌리에서 손끝까지의 거리"는 펴면 길어지고 접으면 짧아지므로
 * 방향과 무관하게 동작합니다.
 */
export function isFingerExtended(
  lm: HandLandmarks,
  tipIdx: number,
  pipIdx: number,
  mcpIdx?: number,
): boolean {
  // MCP를 모르면 PIP 인덱스에서 한 칸 앞이 MCP라는 규칙을 씁니다
  // (MediaPipe 순서: MCP, PIP, DIP, TIP).
  const mcp = lm[mcpIdx ?? pipIdx - 1];
  return distance2D(lm[tipIdx], mcp) > distance2D(lm[pipIdx], mcp) * 1.5;
}

/**
 * 엄지는 특별합니다 — 손바닥 쪽이 아니라 옆으로 접히기 때문입니다.
 * 접힌 엄지는 검지 MCP 근처에 붙고, 편 엄지는 바깥으로 벌어집니다.
 */
export function isThumbExtended(lm: HandLandmarks): boolean {
  return distance2D(lm[LM.THUMB_TIP], lm[LM.INDEX_MCP]) / handSize(lm) > 0.55;
}

/** 다섯 손가락의 폄 상태를 한 번에 담는 객체. */
export interface FingerState {
  thumb: boolean;
  index: boolean;
  middle: boolean;
  ring: boolean;
  pinky: boolean;
}

export function getFingerState(lm: HandLandmarks): FingerState {
  return {
    thumb: isThumbExtended(lm),
    index: isFingerExtended(lm, LM.INDEX_TIP, LM.INDEX_PIP, LM.INDEX_MCP),
    middle: isFingerExtended(lm, LM.MIDDLE_TIP, LM.MIDDLE_PIP, LM.MIDDLE_MCP),
    ring: isFingerExtended(lm, LM.RING_TIP, LM.RING_PIP, LM.RING_MCP),
    pinky: isFingerExtended(lm, LM.PINKY_TIP, LM.PINKY_PIP, LM.PINKY_MCP),
  };
}

/** 펴진 손가락 개수(0~5). 분류기의 1차 필터로 유용합니다. */
export function extendedFingerCount(state: FingerState): number {
  return (
    Number(state.thumb) +
    Number(state.index) +
    Number(state.middle) +
    Number(state.ring) +
    Number(state.pinky)
  );
}

// -----------------------------------------------------------------------------
// 손끝 맞닿음(핀치) 판별
// -----------------------------------------------------------------------------

/** 두 랜드마크가 손 크기 대비 얼마나 가까운지 (0에 가까울수록 붙음). */
export function normalizedGap(
  lm: HandLandmarks,
  aIdx: number,
  bIdx: number,
): number {
  return distance2D(lm[aIdx], lm[bIdx]) / handSize(lm);
}

/** 엄지 + 검지가 붙어 동그라미(ㅇ, OK)를 만들었는가? */
export function thumbIndexPinch(lm: HandLandmarks): boolean {
  return normalizedGap(lm, LM.THUMB_TIP, LM.INDEX_TIP) < 0.35;
}

/** 엄지 + 중지가 붙었는가? (핑거스냅 이펙트용) */
export function thumbMiddlePinch(lm: HandLandmarks): boolean {
  return normalizedGap(lm, LM.THUMB_TIP, LM.MIDDLE_TIP) < 0.35;
}

// -----------------------------------------------------------------------------
// 방향 계산
// -----------------------------------------------------------------------------

/** 2D 벡터. */
export interface Vec2 {
  x: number;
  y: number;
}

/** from → to 방향 벡터(정규화 좌표계 그대로). */
export function vector(from: Landmark, to: Landmark): Vec2 {
  return { x: to.x - from.x, y: to.y - from.y };
}

/** 길이 1로 정규화. */
export function normalize(v: Vec2): Vec2 {
  const mag = Math.hypot(v.x, v.y) || 1e-6;
  return { x: v.x / mag, y: v.y / mag };
}

/**
 * 화면(거울) 좌표계 기준 방향 벡터.
 *
 * 카메라 원본은 좌우가 뒤집혀 있고 화면에는 거울처럼 보여줍니다. 사용자가
 * "오른쪽"을 가리키면 화면에서도 오른쪽으로 보여야 자연스러우므로, x축을
 * 뒤집어서 사용자가 보는 방향과 일치시킵니다.
 *
 * 주의: 이미지 좌표계는 y가 아래로 증가합니다. 그래서 "위"는 y가 감소하는
 * 방향이며, 아래 헬퍼들이 그 부호를 처리해 줍니다.
 */
export function displayVector(from: Landmark, to: Landmark): Vec2 {
  const v = vector(from, to);
  return normalize({ x: -v.x, y: v.y });
}

/** 네 가지 기본 방향. */
export type Direction4 = 'up' | 'down' | 'left' | 'right';

/** 각 방향의 기준 벡터 (화면 좌표계, y는 아래가 +). */
const DIRECTION_VECTORS: Record<Direction4, Vec2> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/**
 * 방향 일치도를 0~1로 반환합니다.
 * 내적(dot product)이 1이면 완전히 같은 방향, -1이면 정반대입니다.
 * 이를 0~1로 옮기고 제곱해서 "정확히 그 방향일 때만 높은 점수"가 되게 합니다.
 */
export function directionScore(v: Vec2, dir: Direction4): number {
  const target = DIRECTION_VECTORS[dir];
  const n = normalize(v);
  const dot = n.x * target.x + n.y * target.y;
  const zeroToOne = (dot + 1) / 2; // -1..1 → 0..1
  return zeroToOne * zeroToOne; // 날카롭게
}

/** 특정 손가락이 가리키는 방향(화면 기준). MCP → TIP 벡터를 씁니다. */
export function fingerDirection(
  lm: HandLandmarks,
  mcpIdx: number,
  tipIdx: number,
): Vec2 {
  return displayVector(lm[mcpIdx], lm[tipIdx]);
}

/** 검지가 가리키는 방향(화면 기준). */
export function indexDirection(lm: HandLandmarks): Vec2 {
  return fingerDirection(lm, LM.INDEX_MCP, LM.INDEX_TIP);
}

/** 손 전체가 향한 방향 (손목 → 중지 MCP). 손바닥/화염 방향에 사용. */
export function handDirection(lm: HandLandmarks): Vec2 {
  return displayVector(lm[LM.WRIST], lm[LM.MIDDLE_MCP]);
}

/**
 * 검지가 얼마나 수직인지 [-1, 1].
 * 1 = 똑바로 위, -1 = 똑바로 아래.
 * (이전 버전과의 호환을 위해 남겨둔 헬퍼입니다.)
 */
export function indexVerticality(lm: HandLandmarks): number {
  const v = vector(lm[LM.INDEX_MCP], lm[LM.INDEX_TIP]);
  const mag = Math.hypot(v.x, v.y) || 1e-6;
  return -v.y / mag; // 이미지 y는 아래가 +이므로 부호를 뒤집습니다.
}

/** 손가락이 얼마나 수평인지 0~1 (1 = 완전히 옆으로). */
export function horizontality(v: Vec2): number {
  const n = normalize(v);
  return Math.abs(n.x);
}

// -----------------------------------------------------------------------------
// 관절 각도
// -----------------------------------------------------------------------------

/**
 * 세 점이 이루는 각도(b가 꼭짓점)를 도(degree) 단위로 반환합니다.
 * 곧게 편 손가락은 180°에 가깝고, 직각으로 꺾으면 90° 근처가 됩니다.
 *
 * 이 값으로 "곧게 편 검지(ㅏ)"와 "갈고리처럼 꺾은 검지(ㄱ)"를 구분합니다.
 */
export function jointAngle(
  lm: HandLandmarks,
  aIdx: number,
  bIdx: number,
  cIdx: number,
): number {
  const a = lm[aIdx];
  const b = lm[bIdx];
  const c = lm[cIdx];
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const mag1 = Math.hypot(v1.x, v1.y) || 1e-6;
  const mag2 = Math.hypot(v2.x, v2.y) || 1e-6;
  // 부동소수점 오차로 acos 범위를 벗어나지 않도록 -1~1로 자릅니다.
  const cos = Math.min(1, Math.max(-1, (v1.x * v2.x + v1.y * v2.y) / (mag1 * mag2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** 검지가 곧게 펴졌는지 0~1 (1 = 완전히 곧음). */
export function indexStraightness(lm: HandLandmarks): number {
  const angle = jointAngle(lm, LM.INDEX_MCP, LM.INDEX_PIP, LM.INDEX_TIP);
  // 130° 이하는 확실히 꺾인 것, 170° 이상은 확실히 곧은 것으로 봅니다.
  return Math.min(1, Math.max(0, (angle - 130) / 40));
}

// -----------------------------------------------------------------------------
// 손가락 굽힘 3단계 판별
// -----------------------------------------------------------------------------
// 왜 필요한가?
//   이전에는 손가락을 "폈다/접었다" 두 가지로만 봤습니다. 그런데 실제 지문자에는
//   "첫마디만 펴고 둘째마디는 굽힌" 상태가 있습니다(갈퀴형, 구부림형).
//   두 단계로만 보면 이 손가락이 "접힌 것"으로 잘못 읽혀 ㅁ 같은 글자를
//   아예 인식하지 못합니다. 혼동 행렬 테스트에서 실제로 잡힌 버그입니다.

/** 손가락 굽힘 상태 3단계. */
export type Flexion = 'extended' | 'bent' | 'curled';

/**
 * 손가락 하나의 굽힘 상태를 판별합니다.
 *
 * 두 가지 정보를 함께 봅니다.
 *   1. 손끝이 PIP 관절보다 손목에서 먼가? (뻗었는가)
 *   2. 관절 각도가 곧은가? (굽었는가)
 *
 * 조합:
 *   뻗음 + 곧음  → extended (완전히 폄)
 *   뻗음 + 굽음  → bent     (첫마디만 폄, 갈고리)
 *   안 뻗음      → curled   (완전히 접음)
 */
export function getFingerFlexion(
  lm: HandLandmarks,
  mcpIdx: number,
  pipIdx: number,
  tipIdx: number,
): Flexion {
  // MCP(뿌리 관절) 기준으로 재야 손가락 방향과 무관하게 동작합니다.
  const mcp = lm[mcpIdx];
  const tipReach = distance2D(lm[tipIdx], mcp);
  const pipReach = distance2D(lm[pipIdx], mcp);
  const angle = jointAngle(lm, mcpIdx, pipIdx, tipIdx);

  // 손끝이 PIP보다 뿌리에서 훨씬 멀리 나가 있으면 뻗은 것입니다.
  if (tipReach > pipReach * 1.5) {
    return angle >= 150 ? 'extended' : 'bent';
  }
  // 덜 뻗었더라도 첫마디는 세워져 있는 "갈퀴" 상태일 수 있습니다.
  if (tipReach > pipReach * 0.9 && angle >= 70) return 'bent';

  return 'curled';
}

/** 다섯 손가락의 굽힘 상태. */
export interface FingerFlexions {
  thumb: Flexion;
  index: Flexion;
  middle: Flexion;
  ring: Flexion;
  pinky: Flexion;
}

export function getFingerFlexions(lm: HandLandmarks): FingerFlexions {
  return {
    // 엄지는 옆으로 벌어지므로 기존 판별을 재사용합니다.
    thumb: isThumbExtended(lm) ? 'extended' : 'curled',
    index: getFingerFlexion(lm, LM.INDEX_MCP, LM.INDEX_PIP, LM.INDEX_TIP),
    middle: getFingerFlexion(lm, LM.MIDDLE_MCP, LM.MIDDLE_PIP, LM.MIDDLE_TIP),
    ring: getFingerFlexion(lm, LM.RING_MCP, LM.RING_PIP, LM.RING_TIP),
    pinky: getFingerFlexion(lm, LM.PINKY_MCP, LM.PINKY_PIP, LM.PINKY_TIP),
  };
}
