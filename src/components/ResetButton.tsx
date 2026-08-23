// 인식된 텍스트와 분류기 상태를 초기화합니다.
// 이펙트 모드에서는 화면의 파티클을 지우는 용도로도 씁니다.

import { ResetIcon } from './icons';

interface Props {
  onReset: () => void;
  disabled?: boolean;
  /** 버튼에 표시할 문구 (모드에 따라 다르게 씁니다). */
  label?: string;
}

export function ResetButton({ onReset, disabled, label = '초기화' }: Props) {
  return (
    <button
      type="button"
      className="btn btn--secondary"
      onClick={onReset}
      disabled={disabled}
      aria-label={label}
    >
      <ResetIcon />
      {label}
    </button>
  );
}
