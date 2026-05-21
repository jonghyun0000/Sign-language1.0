/**
 * ConfidenceIndicator 컴포넌트
 * Confidence Indicator Component
 *
 * 현재 인식되고 있는 제스처와 그 신뢰도를 시각적으로 표시합니다.
 * Visually displays the currently recognized gesture and its confidence.
 */

import { Activity, HandMetal } from 'lucide-react';
import { GestureResult } from '../types';

interface ConfidenceIndicatorProps {
  gesture: GestureResult;
}

export function ConfidenceIndicator({ gesture }: ConfidenceIndicatorProps) {
  const percentage = Math.round(gesture.confidence * 100);
  const hasGesture = gesture.gesture && gesture.type !== 'none';

  // 신뢰도에 따른 색상 결정 / Color based on confidence
  const getConfidenceColor = (): string => {
    if (percentage >= 95) return 'var(--color-success)';
    if (percentage >= 85) return 'var(--color-accent)';
    if (percentage >= 70) return 'var(--color-warning)';
    return 'var(--color-muted)';
  };

  return (
    <div className="confidence-indicator">
      {/* 현재 인식된 제스처 표시 */}
      {/* Currently recognized gesture display */}
      <div className="gesture-display">
        <div className="gesture-display-label">
          <HandMetal size={16} strokeWidth={1.5} />
          <span>현재 제스처</span>
        </div>
        <div className="gesture-display-value">
          {hasGesture ? (
            <>
              <span className="gesture-character">{gesture.gesture}</span>
              <span className="gesture-type">
                {gesture.type === 'word' ? '단어' : '자음'}
              </span>
            </>
          ) : (
            <span className="gesture-empty">대기 중</span>
          )}
        </div>
      </div>

      {/* 신뢰도 바 표시 */}
      {/* Confidence bar display */}
      <div className="confidence-bar-container">
        <div className="confidence-bar-label">
          <Activity size={16} strokeWidth={1.5} />
          <span>신뢰도</span>
          <span className="confidence-percentage" style={{ color: getConfidenceColor() }}>
            {percentage}%
          </span>
        </div>
        <div className="confidence-bar-track">
          <div
            className="confidence-bar-fill"
            style={{
              width: `${percentage}%`,
              backgroundColor: getConfidenceColor(),
            }}
          />
        </div>
      </div>
    </div>
  );
}
