/**
 * 제스처 분류기 (Rule-based Classifier)
 * Gesture Classifier (Rule-based)
 *
 * MediaPipe로 감지된 손 랜드마크를 분석하여 한국어 자음 또는 단어로 분류합니다.
 * Analyzes hand landmarks detected by MediaPipe to classify them as Korean consonants or words.
 *
 * 향후 개선 (Future improvement):
 *   - TensorFlow.js 모델로 교체 가능
 *   - 데이터 수집 후 학습된 분류기 사용
 *   - Can be replaced with a TensorFlow.js model
 *   - Use a trained classifier after data collection
 */

import {
  FingerStates,
  GestureResult,
  HAND_LANDMARKS,
  HandLandmarks,
  HandTrackingResult,
  Landmark,
} from '../types';
import {
  CONSONANT_PATTERNS,
  SingleHandPattern,
  TwoHandPattern,
  WORD_PATTERNS,
} from '../data/gesturePatterns';

// ============================================================
// 유틸리티 함수 / Utility functions
// ============================================================

/**
 * 두 랜드마크 사이의 3D 유클리드 거리 계산
 * Calculate 3D Euclidean distance between two landmarks
 */
function distance(a: Landmark, b: Landmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * 손가락이 펴졌는지 굽혔는지 판단합니다.
 * Determines whether a finger is extended or folded.
 *
 * 원리: 손가락 끝(TIP)이 손목(WRIST)으로부터 손가락 관절(PIP)보다 더 멀리 있으면 펴진 상태입니다.
 * Principle: A finger is extended if the TIP is farther from the WRIST than the PIP joint.
 *
 * 엄지의 경우 측면으로 움직이므로 다른 방식(검지 MCP와의 거리)을 사용합니다.
 * For the thumb, since it moves sideways, we use a different method (distance to index MCP).
 */
function getFingerStates(landmarks: HandLandmarks): FingerStates {
  const wrist = landmarks[HAND_LANDMARKS.WRIST];

  // 엄지: 엄지 끝이 검지 MCP보다 충분히 떨어져 있는지 확인
  // Thumb: Check if thumb tip is sufficiently far from index MCP
  const thumbTip = landmarks[HAND_LANDMARKS.THUMB_TIP];
  const indexMcp = landmarks[HAND_LANDMARKS.INDEX_MCP];
  const thumbMcp = landmarks[HAND_LANDMARKS.THUMB_MCP];
  const thumbToIndex = distance(thumbTip, indexMcp);
  const thumbBaseToIndex = distance(thumbMcp, indexMcp);
  const thumb = thumbToIndex > thumbBaseToIndex * 1.1;

  // 검지, 중지, 약지, 소지: TIP과 WRIST 거리가 PIP과 WRIST 거리보다 큰지 확인
  // Index, Middle, Ring, Pinky: Check if TIP-WRIST distance > PIP-WRIST distance
  const isExtended = (tipIdx: number, pipIdx: number): boolean => {
    const tipDist = distance(landmarks[tipIdx], wrist);
    const pipDist = distance(landmarks[pipIdx], wrist);
    return tipDist > pipDist * 1.05; // 약간의 마진 / Small margin
  };

  return {
    thumb,
    index: isExtended(HAND_LANDMARKS.INDEX_TIP, HAND_LANDMARKS.INDEX_PIP),
    middle: isExtended(HAND_LANDMARKS.MIDDLE_TIP, HAND_LANDMARKS.MIDDLE_PIP),
    ring: isExtended(HAND_LANDMARKS.RING_TIP, HAND_LANDMARKS.RING_PIP),
    pinky: isExtended(HAND_LANDMARKS.PINKY_TIP, HAND_LANDMARKS.PINKY_PIP),
  };
}

/**
 * 두 손가락 상태 객체가 얼마나 일치하는지 점수로 환산 (0~1)
 * Score how well two finger state objects match (0~1)
 */
function fingerStatesMatchScore(a: FingerStates, b: FingerStates): number {
  let matches = 0;
  const fingers: Array<keyof FingerStates> = ['thumb', 'index', 'middle', 'ring', 'pinky'];
  for (const finger of fingers) {
    if (a[finger] === b[finger]) matches += 1;
  }
  return matches / fingers.length; // 0~1 정규화 / Normalize to 0~1
}

/**
 * 추가 조건 검사 (특정 손가락 간 거리/접촉 등)
 * Check extra conditions (distance/contact between specific fingers, etc.)
 */
function checkExtraCondition(
  landmarks: HandLandmarks,
  condition: SingleHandPattern['extraCondition']
): boolean {
  if (!condition || condition === 'none') return true;

  const thumbTip = landmarks[HAND_LANDMARKS.THUMB_TIP];
  const indexTip = landmarks[HAND_LANDMARKS.INDEX_TIP];
  const middleTip = landmarks[HAND_LANDMARKS.MIDDLE_TIP];

  // 손바닥 너비를 기준으로 거리 정규화 (손과 카메라 거리에 무관하도록)
  // Normalize distance by palm width (to be independent of hand-camera distance)
  const palmWidth = distance(
    landmarks[HAND_LANDMARKS.INDEX_MCP],
    landmarks[HAND_LANDMARKS.PINKY_MCP]
  );

  switch (condition) {
    case 'thumbIndexTouch': {
      // ㅇ (OK 사인): 엄지와 검지가 만나야 함
      // For OK sign: thumb and index must touch
      const d = distance(thumbTip, indexTip);
      return d < palmWidth * 0.5;
    }
    case 'indexMiddleSpread': {
      // ㅅ (V자): 검지와 중지가 충분히 벌어져 있어야 함
      // For V shape: index and middle should be well separated
      const d = distance(indexTip, middleTip);
      return d > palmWidth * 0.4;
    }
    case 'indexMiddleClose': {
      const d = distance(indexTip, middleTip);
      return d < palmWidth * 0.3;
    }
    default:
      return true;
  }
}

// ============================================================
// 분류기 본체 / Classifier core
// ============================================================

export class GestureClassifier {
  /**
   * 손 추적 결과로부터 한국어 제스처를 분류합니다.
   * Classify Korean gestures from hand tracking results.
   *
   * 동작 순서:
   * 1. 양손이 모두 감지되면 단어 패턴부터 먼저 매칭 시도
   * 2. 그렇지 않으면 단일 손 자음 패턴 매칭
   * 3. 가장 높은 신뢰도의 패턴 반환
   *
   * Order of operation:
   * 1. If both hands detected, try word patterns first
   * 2. Otherwise, try single-hand consonant patterns
   * 3. Return pattern with highest confidence
   */
  classify(tracking: HandTrackingResult): GestureResult {
    const { landmarks, handedness } = tracking;

    // 손이 감지되지 않은 경우
    // No hand detected
    if (!landmarks || landmarks.length === 0) {
      return { gesture: '', confidence: 0, type: 'none' };
    }

    // 양손 단어 인식 시도 (두 손이 모두 감지된 경우)
    // Try two-hand word recognition (when both hands detected)
    if (landmarks.length === 2) {
      const wordResult = this.classifyWord(landmarks, handedness);
      // 단어 신뢰도가 충분히 높을 때만 단어로 반환
      // Return as word only if word confidence is high enough
      if (wordResult.confidence >= 0.85) {
        return wordResult;
      }
    }

    // 단일 손 자음 인식 (첫 번째 감지된 손 사용)
    // Single-hand consonant recognition (use first detected hand)
    return this.classifyCharacter(landmarks[0]);
  }

  /**
   * 단일 손 자음 분류
   * Classify single-hand consonant
   */
  private classifyCharacter(landmarks: HandLandmarks): GestureResult {
    const states = getFingerStates(landmarks);

    let bestMatch: SingleHandPattern | null = null;
    let bestScore = 0;

    for (const pattern of CONSONANT_PATTERNS) {
      const stateScore = fingerStatesMatchScore(states, pattern.fingerStates);
      const conditionOk = checkExtraCondition(landmarks, pattern.extraCondition);

      // 모든 손가락 상태가 일치하고 추가 조건도 만족할 때만 인정
      // Only count if all finger states match and extra condition is satisfied
      if (stateScore === 1 && conditionOk) {
        // 신뢰도 1.0으로 우선 매칭. 추가 조건이 있는 패턴이 더 구체적이므로 우선시
        // Match with confidence 1.0. Prefer patterns with extra conditions (more specific)
        const score = pattern.extraCondition && pattern.extraCondition !== 'none' ? 1.0 : 0.95;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = pattern;
        }
      }
    }

    if (bestMatch) {
      return {
        gesture: bestMatch.character,
        confidence: bestScore,
        type: 'character',
      };
    }

    return { gesture: '', confidence: 0, type: 'none' };
  }

  /**
   * 양손 단어 분류
   * Classify two-hand word
   *
   * MediaPipe는 카메라 좌우반전 영상 기준으로 손 방향을 판정하므로,
   * 사용자 입장에서 왼손/오른손과 일치하도록 처리합니다.
   * MediaPipe determines handedness based on mirrored camera view,
   * so we handle it to match the user's actual left/right hand.
   */
  private classifyWord(
    landmarks: HandLandmarks[],
    handedness: HandTrackingResult['handedness']
  ): GestureResult {
    // 손 두 개의 손가락 상태 계산
    // Calculate finger states for both hands
    const states0 = getFingerStates(landmarks[0]);
    const states1 = getFingerStates(landmarks[1]);

    // 어느 손이 왼손/오른손인지 식별
    // Identify which hand is left/right
    const hand0Side = handedness[0]?.categoryName;
    let leftStates: FingerStates;
    let rightStates: FingerStates;
    if (hand0Side === 'Left') {
      leftStates = states0;
      rightStates = states1;
    } else {
      leftStates = states1;
      rightStates = states0;
    }

    let bestMatch: TwoHandPattern | null = null;
    let bestScore = 0;

    for (const pattern of WORD_PATTERNS) {
      // 좌우 일치 시도 / Try left-right matching
      const directScore =
        (fingerStatesMatchScore(leftStates, pattern.leftHand) +
          fingerStatesMatchScore(rightStates, pattern.rightHand)) /
        2;

      // 좌우 바꿔서도 시도 (대칭적 단어를 위해)
      // Try swapped (for symmetric words)
      const swappedScore =
        (fingerStatesMatchScore(leftStates, pattern.rightHand) +
          fingerStatesMatchScore(rightStates, pattern.leftHand)) /
        2;

      const score = Math.max(directScore, swappedScore);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = pattern;
      }
    }

    if (bestMatch && bestScore >= 0.85) {
      return {
        gesture: bestMatch.word,
        confidence: bestScore,
        type: 'word',
      };
    }

    return { gesture: '', confidence: 0, type: 'none' };
  }
}
