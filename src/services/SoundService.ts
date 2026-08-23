// =============================================================================
// SoundService — Web Audio API로 효과음을 "합성"합니다
// =============================================================================
// 왜 합성인가?
//   mp3 파일을 쓰면 저작권과 용량 문제가 생깁니다. Web Audio의 오실레이터와
//   노이즈만으로도 거미줄 발사음, 번개, 폭발음을 충분히 만들 수 있습니다.
//   외부 파일이 전혀 없으니 오프라인에서도 동작합니다.
//
// 브라우저 정책 주의:
//   사용자가 클릭/터치하기 전에는 AudioContext가 재생되지 않습니다(자동재생
//   차단). 그래서 처음 버튼을 누를 때 `unlock()`을 호출해 컨텍스트를 깨웁니다.

export class SoundService {
  private ctx: AudioContext | null = null;
  /** 전체 볼륨 조절용 마스터 게인. */
  private master: GainNode | null = null;
  private enabled = true;

  /** 화염처럼 "누르고 있는 동안" 계속 나는 소리의 핸들. */
  private loopSource: AudioBufferSourceNode | null = null;
  private loopGain: GainNode | null = null;

  /** 재사용할 화이트 노이즈 버퍼(매번 만들면 낭비). */
  private noiseBuffer: AudioBuffer | null = null;

  /** Web Audio 지원 여부. */
  static isSupported(): boolean {
    return typeof window !== 'undefined' && 'AudioContext' in window;
  }

  /**
   * 사용자 제스처(클릭) 안에서 호출해 오디오를 활성화합니다.
   * 이미 활성화되어 있으면 아무 일도 하지 않습니다.
   */
  unlock(): void {
    if (!SoundService.isSupported()) return;
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35; // 너무 크지 않게
      this.master.connect(this.ctx.destination);
    }
    // 탭 전환 등으로 멈춰 있으면 다시 재생 상태로 돌립니다.
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /** 소리 켜기/끄기. */
  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) this.stopLoop();
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(on ? 0.35 : 0, this.ctx.currentTime, 0.02);
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /** 재생 준비가 되었는지 (컨텍스트가 살아 있는지). */
  private get ready(): boolean {
    return Boolean(this.enabled && this.ctx && this.master);
  }

  /** 화이트 노이즈 버퍼를 만들어 재사용합니다. */
  private getNoiseBuffer(): AudioBuffer {
    const ctx = this.ctx as AudioContext;
    if (this.noiseBuffer) return this.noiseBuffer;
    const length = ctx.sampleRate * 2; // 2초짜리를 루프해서 씁니다.
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buffer;
    return buffer;
  }

  // ---------------------------------------------------------------------------
  // 개별 효과음
  // ---------------------------------------------------------------------------

  /**
   * 🕸️ 거미줄 발사음 ("츄웁!").
   * 노이즈를 밴드패스로 훑어 내리면 공기가 빠르게 지나가는 소리가 납니다.
   */
  webShot(): void {
    if (!this.ready) return;
    const ctx = this.ctx as AudioContext;
    const now = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer();

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 6;
    // 3000Hz → 600Hz로 빠르게 하강 = "슈웅" 하는 발사감
    filter.frequency.setValueAtTime(3000, now);
    filter.frequency.exponentialRampToValueAtTime(600, now + 0.18);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.9, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    src.connect(filter).connect(gain).connect(this.master as GainNode);
    src.start(now);
    src.stop(now + 0.25);
  }

  /** ⚡ 번개 "지직" 소리. 사각파 + 노이즈의 짧은 조합. */
  zap(): void {
    if (!this.ready) return;
    const ctx = this.ctx as AudioContext;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(120 + Math.random() * 200, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.09);

    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2000;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    osc.connect(gain);
    noise.connect(hp).connect(gain);
    gain.connect(this.master as GainNode);

    osc.start(now);
    noise.start(now);
    osc.stop(now + 0.13);
    noise.stop(now + 0.13);
  }

  /** ✨ 반짝임 — 높은 사인파 짧은 "핑". */
  sparkle(): void {
    if (!this.ready) return;
    const ctx = this.ctx as AudioContext;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    // 오음계에서 무작위로 골라 어떤 조합이든 듣기 좋게 만듭니다.
    const scale = [880, 987.77, 1174.66, 1318.51, 1567.98];
    osc.frequency.value = scale[Math.floor(Math.random() * scale.length)];

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.25, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

    osc.connect(gain).connect(this.master as GainNode);
    osc.start(now);
    osc.stop(now + 0.36);
  }

  /** 💥 폭발 / 충격파 — 낮은 사인 하강 + 노이즈. */
  boom(intensity = 1): void {
    if (!this.ready) return;
    const ctx = this.ctx as AudioContext;
    const now = ctx.currentTime;
    const dur = 0.4 + intensity * 0.3;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160 * intensity, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + dur);

    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1200, now);
    lp.frequency.exponentialRampToValueAtTime(200, now + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(Math.min(1, 0.6 * intensity), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(gain);
    noise.connect(lp).connect(gain);
    gain.connect(this.master as GainNode);

    osc.start(now);
    noise.start(now);
    osc.stop(now + dur);
    noise.stop(now + dur);
  }

  /** 💖 하트 — 부드러운 종소리. */
  chime(): void {
    if (!this.ready) return;
    const ctx = this.ctx as AudioContext;
    const now = ctx.currentTime;
    // 화음(루트 + 5도)으로 포근한 느낌을 냅니다.
    for (const [freq, delay] of [
      [659.25, 0],
      [987.77, 0.06],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.2, now + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.7);
      osc.connect(gain).connect(this.master as GainNode);
      osc.start(now + delay);
      osc.stop(now + delay + 0.72);
    }
  }

  /** 💥 핑거스냅 — 아주 짧은 딱 소리. */
  snap(): void {
    if (!this.ready) return;
    const ctx = this.ctx as AudioContext;
    const now = ctx.currentTime;

    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2500;
    bp.Q.value = 2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.9, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

    noise.connect(bp).connect(gain).connect(this.master as GainNode);
    noise.start(now);
    noise.stop(now + 0.07);
  }

  /**
   * ✊ 에너지 충전음 — 점점 높아지는 톤.
   * `stopLoop()`을 부를 때까지 계속 납니다.
   */
  startCharge(): void {
    if (!this.ready) return;
    this.stopLoop();
    const ctx = this.ctx as AudioContext;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.linearRampToValueAtTime(500, now + 2.2);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(400, now);
    lp.frequency.linearRampToValueAtTime(2500, now + 2.2);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.3);

    osc.connect(lp).connect(gain).connect(this.master as GainNode);
    osc.start(now);

    // 루프 핸들에 저장해 나중에 멈출 수 있게 합니다.
    // (BufferSource가 아니라 Oscillator라서 타입을 맞추려 캐스팅합니다.)
    this.loopSource = osc as unknown as AudioBufferSourceNode;
    this.loopGain = gain;
  }

  /**
   * 🔥 화염 방사음 — 필터를 건 노이즈 루프.
   * 이미 다른 루프가 재생 중이면 교체합니다.
   */
  startFire(): void {
    if (!this.ready) return;
    this.stopLoop();
    const ctx = this.ctx as AudioContext;
    const now = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer();
    src.loop = true;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.12);

    src.connect(lp).connect(gain).connect(this.master as GainNode);
    src.start(now);

    this.loopSource = src;
    this.loopGain = gain;
  }

  /** 재생 중인 루프 사운드를 부드럽게 끕니다. */
  stopLoop(): void {
    if (!this.ctx || !this.loopSource) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const source = this.loopSource;
    const gain = this.loopGain;

    if (gain) {
      // 뚝 끊기면 "퍽" 하는 잡음이 나므로 살짝 페이드아웃합니다.
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    }
    try {
      source.stop(now + 0.1);
    } catch {
      // 이미 멈춘 소스를 다시 멈추면 예외가 납니다 — 무시해도 안전합니다.
    }
    this.loopSource = null;
    this.loopGain = null;
  }

  /** 앱 종료 시 정리. */
  dispose(): void {
    this.stopLoop();
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
  }
}
