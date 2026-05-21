/**
 * KoreanTextOutput 컴포넌트
 * Korean Text Output Component
 *
 * 인식된 한국어 텍스트를 표시합니다.
 * Displays the recognized Korean text.
 */

import { FileText } from 'lucide-react';

interface KoreanTextOutputProps {
  text: string;
  pendingGesture?: string;
}

export function KoreanTextOutput({ text, pendingGesture }: KoreanTextOutputProps) {
  return (
    <div className="text-output">
      <div className="text-output-header">
        <FileText size={20} strokeWidth={1.5} />
        <h2>인식된 텍스트</h2>
      </div>

      <div className="text-output-content">
        {text ? (
          <p className="recognized-text">
            {text}
            {/* 현재 인식 중인 제스처 미리보기 (아직 확정 안 됨) */}
            {/* Preview of currently detected gesture (not yet confirmed) */}
            {pendingGesture && (
              <span className="pending-gesture"> {pendingGesture}</span>
            )}
          </p>
        ) : (
          <p className="placeholder-text">
            카메라 앞에서 수어를 표현하면 여기에 텍스트가 나타납니다.
          </p>
        )}
      </div>

      <div className="text-output-footer">
        <span className="text-count">글자 수: {text.length}</span>
      </div>
    </div>
  );
}
