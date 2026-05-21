/**
 * 한국어 음성 합성 서비스 (Web Speech API)
 * Korean Text-to-Speech Service (Web Speech API)
 *
 * 브라우저 내장 Web Speech API를 사용하여 한국어 텍스트를 음성으로 읽어줍니다.
 * Uses the browser's built-in Web Speech API to read Korean text aloud.
 */

export class SpeechService {
  private synth: SpeechSynthesis;
  private koreanVoice: SpeechSynthesisVoice | null = null;

  constructor() {
    this.synth = window.speechSynthesis;
    this.loadVoices();

    // 일부 브라우저는 보이스 목록이 비동기로 로드됨
    // Some browsers load voices asynchronously
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = () => this.loadVoices();
    }
  }

  /**
   * 사용 가능한 한국어 보이스를 찾아 저장
   * Find and store available Korean voice
   */
  private loadVoices(): void {
    const voices = this.synth.getVoices();

    // ko-KR 보이스를 우선 검색
    // Search for ko-KR voice first
    this.koreanVoice =
      voices.find((v) => v.lang === 'ko-KR') ||
      voices.find((v) => v.lang.startsWith('ko')) ||
      null;
  }

  /**
   * 한국어 텍스트를 음성으로 읽어줍니다.
   * Read Korean text aloud.
   *
   * @param text - 읽을 한국어 텍스트 / Korean text to speak
   * @param rate - 말하기 속도 (0.1~10, 기본 1) / Speech rate (0.1~10, default 1)
   * @param pitch - 음높이 (0~2, 기본 1) / Pitch (0~2, default 1)
   */
  speak(text: string, rate: number = 1.0, pitch: number = 1.0): void {
    if (!text.trim()) return;

    // 진행 중인 음성이 있으면 중단
    // Cancel any ongoing speech
    this.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = 1.0;

    if (this.koreanVoice) {
      utterance.voice = this.koreanVoice;
    }

    this.synth.speak(utterance);
  }

  /**
   * 현재 재생 중인 음성을 중단합니다.
   * Cancel currently playing speech.
   */
  cancel(): void {
    if (this.synth.speaking) {
      this.synth.cancel();
    }
  }

  /**
   * 한국어 보이스 사용 가능 여부 / Whether Korean voice is available
   */
  get hasKoreanVoice(): boolean {
    return this.koreanVoice !== null;
  }
}
