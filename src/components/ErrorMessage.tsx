// =============================================================================
// ErrorMessage — 카메라 / 모델 / 음성 오류 배너
// =============================================================================
// 예전에는 오류가 나면 새로고침 말고는 방법이 없었습니다. 이제는 오류 종류에
// 맞는 해결 방법과 **다시 시도 버튼**을 함께 보여줍니다.

import type { AppError, AppErrorKind } from '../types';
import { CloseIcon, ResetIcon } from './icons';

interface Props {
  error: AppError | null;
  onDismiss?: () => void;
  /** 다시 시도 (카메라·모델 다시 불러오기). */
  onRetry?: () => void;
}

/** 오류 종류별로 사용자가 실제로 할 수 있는 조치. */
const RECOVERY: Record<AppErrorKind, string[]> = {
  'camera-permission': [
    '브라우저 주소창 왼쪽의 카메라 아이콘을 눌러 "허용"으로 바꿔주세요.',
    'Mac 사용자는 시스템 설정 → 개인정보 보호 → 카메라에서 브라우저를 켜주세요.',
    '허용한 뒤 아래 "다시 시도"를 누르면 새로고침 없이 다시 연결됩니다.',
  ],
  'camera-unavailable': [
    '다른 프로그램(화상회의 앱 등)이 카메라를 쓰고 있는지 확인해 주세요.',
    '노트북 덮개나 카메라 커버가 닫혀 있지 않은지 확인해 주세요.',
    'USB 웹캠이라면 뽑았다 다시 연결해 보세요.',
  ],
  'model-load': [
    '인터넷 연결을 확인해 주세요. 손 인식 모델을 처음 한 번 내려받아야 합니다.',
    '회사·학교 네트워크라면 방화벽이 CDN을 막고 있을 수 있습니다.',
    '연결을 확인한 뒤 "다시 시도"를 눌러주세요.',
  ],
  'tts-unavailable': [
    '이 브라우저는 한국어 음성 합성을 지원하지 않습니다.',
    'Chrome, Edge, Safari 최신 버전을 사용해 보세요.',
    '음성 없이도 텍스트 인식 기능은 그대로 쓸 수 있습니다.',
  ],
  unknown: ['잠시 후 "다시 시도"를 눌러주세요.'],
};

export function ErrorMessage({ error, onDismiss, onRetry }: Props) {
  if (!error) return null;

  const steps = RECOVERY[error.kind] ?? RECOVERY.unknown;
  // 음성 오류는 다시 시도해도 소용없으므로 버튼을 감춥니다.
  const canRetry = Boolean(onRetry) && error.kind !== 'tts-unavailable';

  return (
    <div role="alert" className={`error-banner error-banner--${error.kind}`}>
      <div className="error-banner__main">
        <strong className="error-banner__title">{error.message}</strong>

        <ul className="error-banner__steps">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>

        {canRetry && (
          <button type="button" className="btn btn--primary" onClick={onRetry}>
            <ResetIcon />
            다시 시도
          </button>
        )}
      </div>

      {onDismiss && (
        <button
          type="button"
          className="error-banner__close"
          onClick={onDismiss}
          aria-label="오류 메시지 닫기"
        >
          <CloseIcon size={16} />
        </button>
      )}
    </div>
  );
}
