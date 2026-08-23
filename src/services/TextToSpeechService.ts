// =============================================================================
// TextToSpeechService — thin wrapper around the Web Speech API
// =============================================================================
// `window.speechSynthesis` is built into every modern browser and is free to
// use. It picks a system Korean voice automatically when we set lang='ko-KR'.
//
// Quirks worth knowing:
//   * Voice list loads asynchronously on some browsers — we poll until ready.
//   * Chrome silently aborts utterances queued before user interaction; we
//     trigger from a click handler so this is fine.

export class TextToSpeechService {
  private voice: SpeechSynthesisVoice | null = null;
  private ready: Promise<void>;

  constructor() {
    this.ready = this.loadVoice();
  }

  /** True when the Web Speech API is available in this browser. */
  static isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  private loadVoice(): Promise<void> {
    if (!TextToSpeechService.isSupported()) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const pickVoice = () => {
        const voices = window.speechSynthesis.getVoices();
        // Prefer ko-KR; fall back to anything Korean; finally first available.
        this.voice =
          voices.find((v) => v.lang === 'ko-KR') ||
          voices.find((v) => v.lang.startsWith('ko')) ||
          voices[0] ||
          null;
        if (voices.length > 0) resolve();
      };
      pickVoice();
      if (!this.voice) {
        window.speechSynthesis.onvoiceschanged = () => {
          pickVoice();
        };
      }
    });
  }

  /**
   * Speak the given Korean text. No-op for empty strings.
   * Cancels any utterance already in flight so rapid clicks feel responsive.
   */
  async speak(text: string): Promise<void> {
    if (!TextToSpeechService.isSupported()) {
      throw new Error('이 브라우저는 음성 합성을 지원하지 않습니다.');
    }
    const trimmed = text.trim();
    if (!trimmed) return;
    await this.ready;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(trimmed);
    utter.lang = 'ko-KR';
    if (this.voice) utter.voice = this.voice;
    utter.rate = 1;
    utter.pitch = 1;
    window.speechSynthesis.speak(utter);
  }

  /** Stop whatever's playing right now. */
  cancel(): void {
    if (TextToSpeechService.isSupported()) {
      window.speechSynthesis.cancel();
    }
  }
}
