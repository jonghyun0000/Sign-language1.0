/**
 * App 컴포넌트 (메인)
 * Main App Component
 *
 * 모든 하위 컴포넌트를 조립하고 손 추적 훅을 사용하여 전체 인식 흐름을 관리합니다.
 * Assembles all sub-components and manages the entire recognition flow using the hand tracking hook.
 */

import { useRef } from 'react';
import { Hand } from 'lucide-react';
import { CameraPreview } from './components/CameraPreview';
import { ConfidenceIndicator } from './components/ConfidenceIndicator';
import { ErrorMessage } from './components/ErrorMessage';
import { GestureGuide } from './components/GestureGuide';
import { KoreanTextOutput } from './components/KoreanTextOutput';
import { ResetButton } from './components/ResetButton';
import { SpeechButton } from './components/SpeechButton';
import { useHandTracking } from './hooks/useHandTracking';
import './styles/App.css';

function App() {
  // 비디오 엘리먼트 ref / Video element ref
  const videoRef = useRef<HTMLVideoElement>(null);

  // 손 추적 훅에서 모든 상태와 함수 가져오기
  // Get all state and functions from hand tracking hook
  const {
    isInitializing,
    currentGesture,
    recognizedText,
    trackingResult,
    error,
    clearText,
    start,
  } = useHandTracking({
    videoRef,
    debounceMs: 1500, // 같은 제스처 재인식까지 1.5초 / 1.5s before same gesture re-recognized
    confirmationMs: 800, // 0.8초간 안정적으로 유지되어야 함 / Must hold steady for 0.8s
    enabled: true, // 자동 시작 / Auto-start
  });

  return (
    <div className="app">
      {/* 헤더 / Header */}
      <header className="app-header">
        <div className="app-header-content">
          <div className="app-logo">
            <Hand size={28} strokeWidth={1.5} />
            <div className="app-title-group">
              <h1>한국 수어 인식기</h1>
              <p className="app-subtitle">Korean Sign Language Recognizer</p>
            </div>
          </div>
          <GestureGuide />
        </div>
      </header>

      {/* 메인 콘텐츠 / Main content */}
      <main className="app-main">
        {/* 에러가 있으면 에러 메시지 우선 표시 */}
        {/* If error exists, show error message first */}
        {error && (
          <ErrorMessage
            error={error}
            onRetry={() => {
              start();
            }}
          />
        )}

        {/* 메인 레이아웃: 좌측 카메라, 우측 텍스트 출력 */}
        {/* Main layout: camera on left, text output on right */}
        <div className="app-grid">
          <section className="app-grid-camera">
            <CameraPreview
              ref={videoRef}
              trackingResult={trackingResult}
              isInitializing={isInitializing}
            />
          </section>

          <section className="app-grid-text">
            <KoreanTextOutput
              text={recognizedText}
              pendingGesture={
                currentGesture.confidence >= 0.85 ? currentGesture.gesture : undefined
              }
            />
          </section>
        </div>

        {/* 하단 영역: 신뢰도 표시 + 액션 버튼들 */}
        {/* Bottom area: confidence indicator + action buttons */}
        <div className="app-bottom">
          <ConfidenceIndicator gesture={currentGesture} />
          <div className="app-actions">
            <SpeechButton text={recognizedText} />
            <ResetButton onReset={clearText} disabled={!recognizedText} />
          </div>
        </div>
      </main>

      <footer className="app-footer">
        <p>
          MVP 프로토타입 · MediaPipe Hands · React + TypeScript · Web Speech API
        </p>
      </footer>
    </div>
  );
}

export default App;
