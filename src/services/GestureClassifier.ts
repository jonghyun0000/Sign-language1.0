// =============================================================================
// GestureClassifier — 규칙 점수 위에 "안정화 + 중복 방지"를 얹은 계층
// =============================================================================
// koreanGestures.ts의 규칙은 프레임마다 최선의 후보를 알려줍니다. 하지만
// MediaPipe는 초당 30프레임으로 동작하므로, 매 프레임 결과를 그대로 텍스트에
// 넣으면 같은 글자가 수십 번 반복되고 순간적인 오인식도 그대로 들어갑니다.
//
// 처리 전략:
//   1. 매 프레임 점수를 계산합니다.
//   2. 최근 프레임의 (라벨, 신뢰도) 기록을 짧게 유지합니다.
//   3. 같은 라벨이 STABILITY_FRAMES 동안 연속으로 1위이고 평균 신뢰도가
//      기준을 넘을 때만 "확정(commit)"합니다.
//   4. 확정 후에는 LOCKOUT_MS 동안 같은 라벨을 잠가서, 사용자가 다음 동작으로
//      넘어갈 시간을 줍니다.
//
// 추가로 "사전(dictionary) 모드"를 지원합니다. 후보 카테고리를 좁히면
// 자음과 모음이 서로 헷갈리는 문제를 크게 줄일 수 있습니다.

import type {
  DictionaryMode,
  GestureCategory,
  GesturePrediction,
  HandLandmarks,
} from '../types';
import { classifyHand } from '../data/koreanGestures';

/** 조정 가능한 값들 — 취향에 맞게 바꿔보세요. */
const STABILITY_FRAMES = 8; // 30fps 기준 약 0.25초
const CONFIDENCE_THRESHOLD = 0.7;
const LOCKOUT_MS = 1200; // 같은 라벨을 다시 확정하기까지의 대기 시간

type Category = Exclude<GestureCategory, 'none'>;

interface FrameEntry {
  label: string | null;
  confidence: number;
}

export interface ClassifierCommit {
  label: string;
  confidence: number;
  category: GestureCategory;
}

export class GestureClassifier {
  private history: FrameEntry[] = [];
  private lastCommitLabel: string | null = null;
  private lastCommitAt = 0;

  /** 현재 사전 모드. */
  private dictionary: DictionaryMode = 'smart';

  /**
   * 스마트 모드에서 "다음에 기대하는 자모 종류".
   * HangulComposer가 알려주는 값을 App이 넣어줍니다.
   */
  private expecting: 'consonant' | 'vowel' = 'consonant';

  /** 사전 모드를 바꿉니다. 진행 중이던 연속 인식은 초기화됩니다. */
  setDictionary(mode: DictionaryMode): void {
    if (this.dictionary === mode) return;
    this.dictionary = mode;
    this.history = [];
  }

  getDictionary(): DictionaryMode {
    return this.dictionary;
  }

  /** 스마트 모드가 참고할 "다음 자모 종류"를 갱신합니다. */
  setExpecting(next: 'consonant' | 'vowel'): void {
    this.expecting = next;
  }

  /**
   * 현재 사전 모드에서 후보로 볼 카테고리 목록.
   * `undefined`를 반환하면 전체를 검사합니다.
   */
  private allowedCategories(): Category[] | undefined {
    switch (this.dictionary) {
      case 'consonant':
        return ['consonant'];
      case 'vowel':
        return ['vowel'];
      case 'word':
        return ['word'];
      case 'smart':
        // 한글 구조상 초성 뒤에는 모음이 옵니다. 인사말은 언제든 쓸 수 있도록
        // 항상 함께 후보에 둡니다.
        //
        // 한때 여기서 'word'를 뺐던 적이 있습니다. 단어 단축 동작이 자모와
        // 손 모양이 완전히 같아서(도와주세요 ≡ ㅗ, 감사합니다 ≡ ㅎ,
        // 괜찮아요 ≡ ㅇ) 자모 인식을 망가뜨렸기 때문입니다. 하지만 그러면
        // 기본 모드에서 인사말이 아예 안 되는 문제가 생겼습니다.
        //
        // 지금은 근본 원인을 고쳤습니다. 단어 단축 동작은 어차피 이 앱이
        // 임의로 정한 것이므로, 자모가 쓰지 않는 빈 손 모양으로 옮겼습니다.
        // 충돌이 없으므로 단어를 다시 넣어도 안전합니다.
        // (npm run confusion 으로 충돌이 없는지 상시 확인합니다)
        return [this.expecting, 'word'];
      case 'all':
      default:
        return undefined;
    }
  }

  /**
   * 한 프레임의 손 랜드마크를 처리합니다.
   *
   * @returns
   *   * `live`   — 현재 프레임의 최선 추정 ("현재 인식" UI용)
   *   * `commit` — 안정적으로 확정된 결과가 있을 때만 non-null
   */
  process(
    hands: HandLandmarks[],
    nowMs: number,
  ): { live: GesturePrediction; commit: ClassifierCommit | null } {
    if (hands.length === 0) {
      this.history = []; // 손이 사라지면 연속 인식 기록을 초기화
      return {
        live: { label: null, confidence: 0, category: 'none' },
        commit: null,
      };
    }

    // MVP에서는 첫 번째로 감지된 손만 분류합니다.
    // (양손 제스처는 규칙을 더 확장해야 합니다 — README 참고)
    const pred = classifyHand(hands[0], this.allowedCategories());

    this.history.push({ label: pred.label, confidence: pred.confidence });
    if (this.history.length > STABILITY_FRAMES) {
      this.history.shift();
    }

    return { live: pred, commit: this.maybeCommit(pred, nowMs) };
  }

  /**
   * 최근 STABILITY_FRAMES가 모두 같은 라벨이고, 평균 신뢰도가 기준을 넘고,
   * 잠금 시간이 지났을 때만 확정 결과를 반환합니다.
   */
  private maybeCommit(
    pred: GesturePrediction,
    nowMs: number,
  ): ClassifierCommit | null {
    if (this.history.length < STABILITY_FRAMES) return null;
    if (!pred.label) return null;

    // 최근 프레임이 모두 같은 라벨이어야 합니다.
    if (!this.history.every((e) => e.label === pred.label)) return null;

    const avgConfidence =
      this.history.reduce((sum, e) => sum + e.confidence, 0) / this.history.length;
    if (avgConfidence < CONFIDENCE_THRESHOLD) return null;

    // 같은 라벨의 연속 입력을 막는 잠금 시간.
    if (
      this.lastCommitLabel === pred.label &&
      nowMs - this.lastCommitAt < LOCKOUT_MS
    ) {
      return null;
    }

    this.lastCommitLabel = pred.label;
    this.lastCommitAt = nowMs;
    // 다음 확정을 위해 기록을 비웁니다(새로 연속 인식이 쌓여야 함).
    this.history = [];

    return {
      label: pred.label,
      confidence: avgConfidence,
      category: pred.category,
    };
  }

  /** 진행 중인 연속 인식을 잊습니다. 초기화 버튼이 호출합니다. */
  reset(): void {
    this.history = [];
    this.lastCommitLabel = null;
    this.lastCommitAt = 0;
    this.expecting = 'consonant';
  }
}
