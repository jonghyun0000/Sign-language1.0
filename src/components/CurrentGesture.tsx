// =============================================================================
// CurrentGesture — 지금 인식 중인 것을 크게 보여주는 위젯
// =============================================================================
// 수어 번역 모드에서는 인식된 자모/단어를 글자로, 이펙트 모드에서는 발동 중인
// 이펙트의 손 모양 그림을 보여줍니다. 사용자가 "지금 내 손이 어떻게 읽히고
// 있는지" 바로 알아야 손 모양을 교정할 수 있습니다.

import type { GestureShape, GesturePrediction } from '../types';
import { HandShape } from './HandShape';
import { HandIcon, QuestionIcon } from './icons';

interface Props {
  /** 수어 번역 모드의 현재 추정. */
  prediction: GesturePrediction;
  /** 이펙트 모드에서 발동 중인 이펙트. 없으면 null. */
  effect: { label: string; shape: GestureShape } | null;
  /** MediaPipe가 손을 하나라도 잡고 있는지. */
  handVisible: boolean;
  /** 이펙트 모드인지. */
  isEffectMode: boolean;
}

const CATEGORY_KO: Record<GesturePrediction['category'], string> = {
  consonant: '자음',
  vowel: '모음',
  word: '단어',
  none: '대기 중',
};

export function CurrentGesture({
  prediction,
  effect,
  handVisible,
  isEffectMode,
}: Props) {
  return (
    <div className="current-gesture" aria-live="polite">
      <div className="current-gesture__label">현재 인식</div>
      <div className="current-gesture__value">
        {renderValue({ prediction, effect, handVisible, isEffectMode })}
      </div>
      <div className="current-gesture__hint">
        {renderHint({ prediction, effect, handVisible, isEffectMode })}
      </div>
    </div>
  );
}

/** 가운데에 크게 보여줄 내용. */
function renderValue({ prediction, effect, handVisible, isEffectMode }: Props) {
  // 손이 아예 안 보이면 손 아이콘.
  if (!handVisible) return <HandIcon size={34} className="icon--muted" />;

  if (isEffectMode) {
    // 이펙트가 발동 중이면 그 손 모양을 그려 보여줍니다.
    if (effect) return <HandShape shape={effect.shape} size={44} active />;
    return <QuestionIcon size={30} className="icon--muted" />;
  }

  // 번역 모드는 인식된 글자를 그대로 크게 보여줍니다.
  if (prediction.label) return <span>{prediction.label}</span>;
  return <QuestionIcon size={30} className="icon--muted" />;
}

/** 옆에 붙는 설명 문구. */
function renderHint({ prediction, effect, handVisible, isEffectMode }: Props): string {
  if (!handVisible) return '손을 카메라 앞에 보여주세요';
  if (isEffectMode) return effect?.label ?? '손 모양을 만들어 보세요';
  return prediction.label ? CATEGORY_KO[prediction.category] : '인식 중…';
}
