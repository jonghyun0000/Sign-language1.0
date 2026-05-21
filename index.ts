/**
 * 프로젝트 전역에서 사용되는 타입 정의
 * Global type definitions used across the project
 */

// MediaPipe Hand의 21개 랜드마크 중 하나의 좌표
// A single landmark coordinate from MediaPipe Hand's 21 landmarks
export interface Landmark {
  x: number; // 정규화된 가로 좌표 (0~1) / Normalized x (0~1)
  y: number; // 정규화된 세로 좌표 (0~1) / Normalized y (0~1)
  z: number; // 손목 기준 깊이 / Depth relative to wrist
}

// 한 손의 랜드마크 배열 (총 21개)
// Array of landmarks for one hand (21 total)
export type HandLandmarks = Landmark[];

// 손의 방향(왼손/오른손) 정보
// Handedness information (Left or Right hand)
export interface Handedness {
  categoryName: 'Left' | 'Right';
  score: number;
}

// MediaPipe Hand 추적 결과
// Result from MediaPipe Hand tracking
export interface HandTrackingResult {
  landmarks: HandLandmarks[]; // 감지된 모든 손의 랜드마크 / Landmarks for all detected hands
  handedness: Handedness[]; // 각 손의 방향 정보 / Handedness for each hand
}

// 손가락 상태 (펴진 상태 = true, 굽힌 상태 = false)
// Finger state (extended = true, folded = false)
export interface FingerStates {
  thumb: boolean; // 엄지 / Thumb
  index: boolean; // 검지 / Index
  middle: boolean; // 중지 / Middle
  ring: boolean; // 약지 / Ring
  pinky: boolean; // 소지 / Pinky
}

// 제스처 인식 결과
// Gesture recognition result
export interface GestureResult {
  gesture: string; // 인식된 한국어 문자/단어 / Recognized Korean character or word
  confidence: number; // 인식 신뢰도 (0~1) / Confidence score (0~1)
  type: 'character' | 'word' | 'none'; // 제스처 종류 / Gesture type
}

// 카메라/MediaPipe 에러 상태
// Camera/MediaPipe error state
export interface AppError {
  type: 'camera' | 'mediapipe' | 'unknown';
  message: string;
}

// 손가락 인덱스 상수 (MediaPipe 표준)
// Finger landmark index constants (MediaPipe standard)
export const HAND_LANDMARKS = {
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
