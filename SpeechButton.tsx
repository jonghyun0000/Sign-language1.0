/**
 * SpeechButton 컴포넌트
 * Speech Button Component
 *
 * 인식된 한국어 텍스트를 음성으로 읽어주는 버튼입니다.
 * Button that reads the recognized Korean text aloud.
 */

import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { SpeechService } from '../services/SpeechService';

interface SpeechButtonProps {
  text: string;
}

export function SpeechButton({ text }: SpeechButtonProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  // SpeechService 인스턴스를 ref로 유지 (재생성 방지)
  // Keep SpeechService instance in ref (avoid recreation)
  const speechServiceRef = useRef<SpeechService | null>(null);

  // 마운트 시 초기화 / Initialize on mount
  useEffect(() => {
    speechServiceRef.current = new SpeechService();
  }, []);

  const handleSpeak = () => {
    if (!text.trim() || !speechServiceRef.current) return;

    if (isSpeaking) {
      // 이미 재생 중이면 중단 / If already playing, cancel
      speechServiceRef.current.cancel();
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);
    speechServiceRef.current.speak(text);

    // Web Speech API는 종료 이벤트를 onend로 제공하지만
    // SpeechService에서 노출하지 않았으므로 polling으로 처리
    // Web Speech API provides onend event, but since SpeechService doesn't expose it,
    // we use polling
    const checkInterval = setInterval(() => {
      if (!window.speechSynthesis.speaking) {
        setIsSpeaking(false);
        clearInterval(checkInterval);
      }
    }, 100);
  };

  // 텍스트가 없으면 비활성화 / Disable if no text
  const isDisabled = !text.trim();

  return (
    <button
      type="button"
      className={`btn btn-speak ${isSpeaking ? 'btn-speak--active' : ''}`}
      onClick={handleSpeak}
      disabled={isDisabled}
      aria-label={isSpeaking ? '음성 중지' : '음성으로 읽기'}
    >
      {isSpeaking ? (
        <VolumeX size={20} strokeWidth={1.5} />
      ) : (
        <Volume2 size={20} strokeWidth={1.5} />
      )}
      <span>{isSpeaking ? '중지' : '음성으로 읽기'}</span>
    </button>
  );
}
