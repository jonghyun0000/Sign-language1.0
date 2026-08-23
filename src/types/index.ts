// =============================================================================
// 공용 타입 정의 (Shared type definitions)
// =============================================================================
// 여러 모듈이 함께 쓰는 타입은 전부 여기에 모아둡니다.
// 초보자 참고: "Landmark"는 MediaPipe가 손에서 찾아내는 21개의 점(손끝, 관절,
// 손목 등) 중 하나입니다. 각 점은 0~1로 정규화된 x/y/z 좌표를 가집니다.

/** MediaPipe Hands가 반환하는 3D 좌표 한 점. */
export interface Landmark {
  x: number;
  y: number;
  z: number;
}

/** 손 하나 = 21개 랜드마크. MediaPipe는 항상 정해진 순서로 반환합니다. */
export type HandLandmarks = Landmark[];

/** MediaPipe가 판단한 왼손/오른손. */
export type Handedness = 'Left' | 'Right';

/** 한 프레임의 손 추적 결과. */
export interface HandFrameResult {
  hands: HandLandmarks[];
  handedness: Handedness[];
  timestampMs: number;
}

// -----------------------------------------------------------------------------
// 수어 번역 관련
// -----------------------------------------------------------------------------

/** 제스처 분류 카테고리. */
export type GestureCategory = 'consonant' | 'vowel' | 'word' | 'none';

/** 분류기가 랜드마크를 보고 내놓는 결과. */
export interface GesturePrediction {
  /** 인식된 한글 자모 또는 단어. 인식 실패 시 null. */
  label: string | null;
  /** 0~1 신뢰도. */
  confidence: number;
  /** UI 표시에 쓰이는 카테고리. */
  category: GestureCategory;
}

/**
 * 사전(dictionary) 모드 — 어떤 제스처 묶음을 후보로 볼지 결정합니다.
 * 후보를 좁힐수록 오인식이 줄어듭니다.
 *
 *  * `smart`     : 자음 → 모음 → 자음 … 으로 자동 전환 (한글 구조를 이용)
 *  * `consonant` : 자음만
 *  * `vowel`     : 모음만
 *  * `word`      : 단어/문장만
 *  * `all`       : 전부 (가장 자유롭지만 오인식 확률이 가장 높음)
 */
export type DictionaryMode = 'smart' | 'consonant' | 'vowel' | 'word' | 'all';

/** 앱의 최상위 모드. */
export type AppMode = 'translate' | 'effect' | 'guide';

/** 저장된 대화 기록 한 줄. */
export interface HistoryEntry {
  id: string;
  text: string;
  /** epoch milliseconds */
  createdAt: number;
}

// -----------------------------------------------------------------------------
// 이펙트 관련
// -----------------------------------------------------------------------------

/**
 * 이펙트 모드에서 인식하는 손동작 종류.
 *
 * 규칙이 아주 단순합니다.
 *   한 손  → 손 주변에서 일어나는 국소 이펙트
 *   양 손  → 같은 손 모양을 두 손으로 하면 "화면 전체 필살기"로 승급
 */
export type EffectGestureId =
  // --- 한 손 (국소) ---
  | 'web'          // 거미줄 발사
  | 'fire'         // 손바닥 화염방사
  | 'lightning'    // 브이 사인 번개
  | 'sparkle'      // 검지 반짝임 트레일
  | 'energy'       // 주먹 에너지 충전 → 충격파
  | 'snap'         // 핑거스냅
  // --- 양 손 (화면 전체) ---
  | 'heart'        // 양손 하트
  | 'webPrison'    // 양손 거미줄 → 화면 전체를 거미줄로 봉인
  | 'inferno'      // 양손 손바닥 → 화면 아래에서 불바다
  | 'thunderstorm' // 양손 브이 → 화면 전체 번개 폭풍
  | 'starstorm'    // 양손 검지 → 화면 전체 별가루 폭풍
  | 'quake';       // 양손 주먹 → 화면 균열 + 진동

/** 한 손 제스처를 양손으로 했을 때 승급되는 화면 전체 이펙트. */
export const TWO_HAND_UPGRADE: Partial<Record<EffectGestureId, EffectGestureId>> = {
  web: 'webPrison',
  fire: 'inferno',
  lightning: 'thunderstorm',
  sparkle: 'starstorm',
  energy: 'quake',
};

/** 화면 전체에 적용되는 이펙트인지 판별합니다. */
export function isScreenWideEffect(id: EffectGestureId): boolean {
  return (
    id === 'webPrison' ||
    id === 'inferno' ||
    id === 'thunderstorm' ||
    id === 'starstorm' ||
    id === 'quake'
  );
}

/** 이펙트 제스처가 감지된 상태. */
export interface EffectDetection {
  id: EffectGestureId;
  confidence: number;
  /** 감지된 손의 인덱스 (양손 제스처는 0). */
  handIndex: number;
}


// -----------------------------------------------------------------------------
// 손 모양 도형 (이모지 대체)
// -----------------------------------------------------------------------------
// 이모지는 기기·폰트마다 모양이 달라서 "정확히 이 손 모양"을 전달하지 못합니다.
// 그래서 손 모양을 데이터로 서술하고, HandShape 컴포넌트가 그 데이터를 보고
// SVG 그림을 그립니다. 분류기 규칙과 그림이 같은 데이터를 쓰므로 설명과 실제
// 인식이 어긋날 수 없습니다.

/** 어떤 손가락을 폈는지. */
export interface FingerSpec {
  thumb: boolean;
  index: boolean;
  middle: boolean;
  ring: boolean;
  pinky: boolean;
}

/** 손이 향하는 방향. */
export type ShapeDirection = 'up' | 'down' | 'left' | 'right';

/** 손 모양 하나를 그리는 데 필요한 정보. */
export interface GestureShape {
  fingers: FingerSpec;
  /** 손끝이 향하는 방향 (기본 'up'). */
  direction?: ShapeDirection;
  /** 엄지가 어느 손가락과 맞닿아 동그라미를 만드는지. */
  pinch?: 'index' | 'middle';
  /** 두 손을 쓰는 제스처인지 (기본 1). */
  hands?: 1 | 2;
  /** 두 손을 맞대는 모양인지 (하트처럼 손끝이 붙는 경우). */
  joined?: boolean;
  /** 검지를 갈고리처럼 꺾는지 (ㄱ과 ㅏ를 구분하는 핵심). */
  bent?: boolean;
  /** 두 손가락을 붙이는지 벌리는지 (ㄷ과 ㅅ을 구분하는 핵심). */
  spread?: 'narrow' | 'wide';
  /** 네 손가락을 갈퀴처럼 첫마디만 펴는지 (갈퀴형). */
  claw?: boolean;
}

// -----------------------------------------------------------------------------
// 오류 처리
// -----------------------------------------------------------------------------

/** UI에서 구분해서 보여줄 오류 종류. */
export type AppErrorKind =
  | 'camera-permission'
  | 'camera-unavailable'
  | 'model-load'
  | 'tts-unavailable'
  | 'unknown';

export interface AppError {
  kind: AppErrorKind;
  message: string;
}
