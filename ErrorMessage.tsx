/**
 * ErrorMessage 컴포넌트
 * Error Message Component
 *
 * 카메라 권한 거부, MediaPipe 로드 실패 등의 에러를 사용자에게 표시합니다.
 * Displays errors such as camera permission denial or MediaPipe load failure.
 */

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { AppError } from '../types';

interface ErrorMessageProps {
  error: AppError;
  onRetry?: () => void;
}

export function ErrorMessage({ error, onRetry }: ErrorMessageProps) {
  // 에러 종류에 따른 제목 결정 / Title based on error type
  const getTitle = (): string => {
    switch (error.type) {
      case 'camera':
        return '카메라 접근 오류';
      case 'mediapipe':
        return '모델 로딩 오류';
      default:
        return '오류가 발생했습니다';
    }
  };

  // 에러 종류에 따른 해결 방법 안내 / Solution guide based on error type
  const getSolution = (): string => {
    switch (error.type) {
      case 'camera':
        return '브라우저 주소창 옆의 카메라 아이콘을 클릭하여 권한을 허용해주세요. HTTPS 또는 localhost 환경에서만 카메라를 사용할 수 있습니다.';
      case 'mediapipe':
        return '인터넷 연결을 확인한 뒤 페이지를 새로고침해주세요. 광고 차단 프로그램이나 방화벽이 CDN 접근을 막고 있을 수 있습니다.';
      default:
        return '문제가 지속되면 브라우저를 새로고침하거나 다른 브라우저를 사용해보세요.';
    }
  };

  return (
    <div className="error-message" role="alert">
      <div className="error-message-icon">
        <AlertTriangle size={32} strokeWidth={1.5} />
      </div>
      <div className="error-message-content">
        <h3 className="error-message-title">{getTitle()}</h3>
        <p className="error-message-body">{error.message}</p>
        <p className="error-message-solution">{getSolution()}</p>
        {onRetry && (
          <button type="button" className="btn btn-retry" onClick={onRetry}>
            <RefreshCw size={16} strokeWidth={1.5} />
            <span>다시 시도</span>
          </button>
        )}
      </div>
    </div>
  );
}
