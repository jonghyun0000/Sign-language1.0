// 인식된 텍스트를 Web Speech API로 읽어줍니다.
// 텍스트가 비었거나 브라우저가 TTS를 지원하지 않으면 비활성화됩니다.

import { SpeakerIcon, StopIcon } from './icons';

interface Props {
  text: string;
  supported: boolean;
  speaking: boolean;
  onSpeak: () => void;
  onStop: () => void;
}

export function SpeechButton({ text, supported, speaking, onSpeak, onStop }: Props) {
  const disabled = !supported || text.trim().length === 0;
  return (
    <button
      type="button"
      className="btn btn--primary"
      onClick={speaking ? onStop : onSpeak}
      disabled={disabled}
      aria-label={speaking ? '음성 출력 중지' : '인식된 텍스트 읽기'}
      title={!supported ? '이 브라우저는 음성 합성을 지원하지 않습니다.' : undefined}
    >
      {speaking ? <StopIcon /> : <SpeakerIcon />}
      {speaking ? '중지' : '말하기'}
    </button>
  );
}
