/**
 * 한국 수어(KSL) 제스처 패턴 정의
 * Korean Sign Language gesture patterns
 *
 * ⚠️ 중요 안내 (Important Notice):
 * 실제 한국 수어(KSL)는 손의 모양뿐 아니라 움직임, 방향, 위치 등이 모두 의미에 포함되는
 * 복잡한 시각언어입니다. 이 MVP에서는 학습용 프로토타입으로서 단순화된 손 모양 규칙을 사용하며,
 * 실제 KSL과 정확히 일치하지 않을 수 있습니다. 추후 학습된 모델로 확장 가능합니다.
 *
 * Real Korean Sign Language (KSL) involves not just hand shapes but also movement,
 * direction, and position. This MVP uses simplified hand-shape rules for learning purposes
 * and may not exactly match real KSL. It can be extended later with a trained model.
 */

import { FingerStates } from '../types';

// 단일 손 제스처 패턴 정의 (자모음)
// Single-hand gesture patterns (consonants)
export interface SingleHandPattern {
  character: string;
  description: string;
  fingerStates: FingerStates;
  // 추가 조건 (선택): 손가락 사이의 거리나 각도
  // Additional conditions (optional): distance or angle between fingers
  extraCondition?: 'thumbIndexTouch' | 'indexMiddleClose' | 'indexMiddleSpread' | 'none';
}

// 양손 제스처 패턴 정의 (단어)
// Two-hand gesture patterns (words)
export interface TwoHandPattern {
  word: string;
  description: string;
  leftHand: FingerStates;
  rightHand: FingerStates;
}

/**
 * 한국어 자음 제스처 패턴
 * Korean consonant gesture patterns
 *
 * 각 자음은 손가락 펴짐/굽힘 상태의 조합으로 구분됩니다.
 * Each consonant is distinguished by a combination of finger extension states.
 */
export const CONSONANT_PATTERNS: SingleHandPattern[] = [
  {
    character: 'ㄱ',
    description: '엄지+검지 펴기 (L자 모양)',
    fingerStates: {
      thumb: true,
      index: true,
      middle: false,
      ring: false,
      pinky: false,
    },
    extraCondition: 'none',
  },
  {
    character: 'ㄴ',
    description: '검지만 펴기',
    fingerStates: {
      thumb: false,
      index: true,
      middle: false,
      ring: false,
      pinky: false,
    },
  },
  {
    character: 'ㄷ',
    description: '엄지+검지+중지 펴기',
    fingerStates: {
      thumb: true,
      index: true,
      middle: true,
      ring: false,
      pinky: false,
    },
  },
  {
    character: 'ㄹ',
    description: '검지+중지+약지 펴기',
    fingerStates: {
      thumb: false,
      index: true,
      middle: true,
      ring: true,
      pinky: false,
    },
  },
  {
    character: 'ㅁ',
    description: '주먹 (모두 굽힘)',
    fingerStates: {
      thumb: false,
      index: false,
      middle: false,
      ring: false,
      pinky: false,
    },
  },
  {
    character: 'ㅂ',
    description: '엄지 제외 4개 손가락 펴기',
    fingerStates: {
      thumb: false,
      index: true,
      middle: true,
      ring: true,
      pinky: true,
    },
  },
  {
    character: 'ㅅ',
    description: '검지+중지 펴기 (V자)',
    fingerStates: {
      thumb: false,
      index: true,
      middle: true,
      ring: false,
      pinky: false,
    },
    extraCondition: 'indexMiddleSpread',
  },
  {
    character: 'ㅇ',
    description: '엄지+검지로 원 만들기 (OK 모양)',
    fingerStates: {
      thumb: true,
      index: true,
      middle: true,
      ring: true,
      pinky: true,
    },
    extraCondition: 'thumbIndexTouch',
  },
  {
    character: 'ㅈ',
    description: '엄지+소지 펴기',
    fingerStates: {
      thumb: true,
      index: false,
      middle: false,
      ring: false,
      pinky: true,
    },
  },
  {
    character: 'ㅎ',
    description: '5개 손가락 모두 펴기 (보자기)',
    fingerStates: {
      thumb: true,
      index: true,
      middle: true,
      ring: true,
      pinky: true,
    },
    extraCondition: 'none',
  },
];

/**
 * 한국어 기본 단어 제스처 패턴 (양손 사용)
 * Korean basic word gesture patterns (two-handed)
 *
 * 양손이 모두 감지되었을 때만 매칭됩니다.
 * Only matched when both hands are detected.
 */
export const WORD_PATTERNS: TwoHandPattern[] = [
  {
    word: '안녕하세요',
    description: '양손 모두 활짝 펴기',
    leftHand: { thumb: true, index: true, middle: true, ring: true, pinky: true },
    rightHand: { thumb: true, index: true, middle: true, ring: true, pinky: true },
  },
  {
    word: '감사합니다',
    description: '양손 모두 주먹 쥐기',
    leftHand: { thumb: false, index: false, middle: false, ring: false, pinky: false },
    rightHand: { thumb: false, index: false, middle: false, ring: false, pinky: false },
  },
  {
    word: '사랑합니다',
    description: '양손 모두 검지+소지 펴기 (락 사인)',
    leftHand: { thumb: false, index: true, middle: false, ring: false, pinky: true },
    rightHand: { thumb: false, index: true, middle: false, ring: false, pinky: true },
  },
  {
    word: '도와주세요',
    description: '한 손은 주먹, 다른 손은 펼친 손바닥',
    leftHand: { thumb: false, index: false, middle: false, ring: false, pinky: false },
    rightHand: { thumb: true, index: true, middle: true, ring: true, pinky: true },
  },
  {
    word: '괜찮아요',
    description: '양손 모두 엄지 척 (따봉)',
    leftHand: { thumb: true, index: false, middle: false, ring: false, pinky: false },
    rightHand: { thumb: true, index: false, middle: false, ring: false, pinky: false },
  },
];
