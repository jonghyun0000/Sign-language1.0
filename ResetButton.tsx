/**
 * ResetButton 컴포넌트
 * Reset Button Component
 *
 * 인식된 텍스트를 모두 지우는 버튼입니다.
 * Button to clear all recognized text.
 */

import { RotateCcw } from 'lucide-react';

interface ResetButtonProps {
  onReset: () => void;
  disabled?: boolean;
}

export function ResetButton({ onReset, disabled }: ResetButtonProps) {
  return (
    <button
      type="button"
      className="btn btn-reset"
      onClick={onReset}
      disabled={disabled}
      aria-label="텍스트 초기화"
    >
      <RotateCcw size={20} strokeWidth={1.5} />
      <span>초기화</span>
    </button>
  );
}
