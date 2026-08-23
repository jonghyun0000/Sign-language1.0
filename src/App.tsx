// =============================================================================
// App — 서비스와 컴포넌트를 연결하는 메인 화면
// =============================================================================
// 세 가지 모드가 있습니다.
//
//   [수어 번역] 손동작 → 한글 자모 → 완성형 한글 → 음성(TTS)
//   [손 이펙트] 손 모양 → 이벤트 → 파티클 이펙트 (한 손은 국소, 양손은 화면 전체)
//   [수어 사전] 인식 가능한 모든 손 모양과 뜻을 보여주는 학습 페이지
//
// 화면 구성:
//   왼쪽  = 카메라 미리보기 (+ 이펙트 캔버스)
//   오른쪽 = 인식된 텍스트 / 이펙트 목록 / 사전
//   아래  = 현재 인식, 신뢰도, 버튼들

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { CameraPreview } from './components/CameraPreview';
import { ConfidenceIndicator } from './components/ConfidenceIndicator';
import { CurrentGesture } from './components/CurrentGesture';
import { DictionarySelector } from './components/DictionarySelector';
import { EffectCanvas } from './components/EffectCanvas';
import { EffectLegend } from './components/EffectLegend';
import { ErrorMessage } from './components/ErrorMessage';
import { HistoryPanel } from './components/HistoryPanel';
import { KoreanTextOutput } from './components/KoreanTextOutput';
import { GuidePage } from './components/GuidePage';
import { ModeSelector } from './components/ModeSelector';
import { ResetButton } from './components/ResetButton';
import { SpeechButton } from './components/SpeechButton';
import {
  BackspaceIcon,
  SaveIcon,
  SpaceIcon,
  SpeakerIcon,
  SpeakerOffIcon,
} from './components/icons';
import { HandShape } from './components/HandShape';

import { EffectManager, getEffectCatalog } from './effects/EffectManager';
import { EffectGestureDetector } from './services/EffectGestureDetector';
import { GestureClassifier } from './services/GestureClassifier';
import { SoundService } from './services/SoundService';
import { TextToSpeechService } from './services/TextToSpeechService';
import { HangulComposer } from './utils/hangulComposer';
import { useHistory } from './hooks/useHistory';
import { GESTURE_RULES } from './data/koreanGestures';

import type {
  AppError,
  AppMode,
  DictionaryMode,
  EffectGestureId,
  GesturePrediction,
  HandFrameResult,
} from './types';
import type { CoverFit } from './utils/coverFit';

/** 이펙트 id → 표시용 정보 (CurrentGesture 위젯에서 사용). */
const EFFECT_INFO = new Map(
  getEffectCatalog().map((e) => [e.id, { label: e.label, shape: e.shape }]),
);

const EMPTY_PREDICTION: GesturePrediction = {
  label: null,
  confidence: 0,
  category: 'none',
};

export default function App() {
  // ---------------------------------------------------------------------------
  // 오래 살아남는 객체들 (한 번만 생성)
  // ---------------------------------------------------------------------------
  const composerRef = useRef<HangulComposer>();
  if (!composerRef.current) composerRef.current = new HangulComposer();

  const classifierRef = useRef<GestureClassifier>();
  if (!classifierRef.current) classifierRef.current = new GestureClassifier();

  const ttsRef = useRef<TextToSpeechService>();
  if (!ttsRef.current) ttsRef.current = new TextToSpeechService();

  const soundRef = useRef<SoundService>();
  if (!soundRef.current) soundRef.current = new SoundService();

  const detectorRef = useRef<EffectGestureDetector>();
  if (!detectorRef.current) detectorRef.current = new EffectGestureDetector();

  const effectManagerRef = useRef<EffectManager>();
  if (!effectManagerRef.current) {
    effectManagerRef.current = new EffectManager(
      detectorRef.current,
      soundRef.current,
    );
  }

  // ---------------------------------------------------------------------------
  // UI 상태
  // ---------------------------------------------------------------------------
  const [mode, setMode] = useState<AppMode>('translate');
  const [dictionary, setDictionary] = useState<DictionaryMode>('smart');
  const [text, setText] = useState('');
  const [composing, setComposing] = useState(false);
  const [expecting, setExpecting] = useState<'consonant' | 'vowel'>('consonant');
  const [livePrediction, setLivePrediction] =
    useState<GesturePrediction>(EMPTY_PREDICTION);
  const [handVisible, setHandVisible] = useState(false);
  const [activeEffect, setActiveEffect] = useState<EffectGestureId | null>(null);
  const [effectConfidence, setEffectConfidence] = useState(0);
  const [error, setError] = useState<AppError | null>(null);
  const [ready, setReady] = useState(false);
  /**
   * 카메라를 다시 연결하기 위한 키.
   * 이 값을 바꾸면 CameraPreview 가 언마운트 → 재마운트되면서 카메라 권한
   * 요청과 모델 로드를 처음부터 다시 합니다. 새로고침 없이 복구할 수 있습니다.
   */
  const [cameraKey, setCameraKey] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [soundOn, setSoundOn] = useState(true);

  const history = useHistory();
  const ttsSupported = useMemo(() => TextToSpeechService.isSupported(), []);

  // 프레임 콜백 안에서 최신 모드를 읽기 위한 ref.
  const modeRef = useRef(mode);
  modeRef.current = mode;

  // ---------------------------------------------------------------------------
  // 사전(dictionary) 모드 동기화
  // ---------------------------------------------------------------------------
  useEffect(() => {
    classifierRef.current?.setDictionary(dictionary);
  }, [dictionary]);

  // ---------------------------------------------------------------------------
  // 모드 전환 처리
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const manager = effectManagerRef.current;
    const classifier = classifierRef.current;
    if (!manager || !classifier) return;

    // 이펙트는 이펙트 모드에서만 발동합니다.
    // (사전 모드에서도 카메라는 계속 돌지만 이펙트는 나오지 않습니다)
    manager.setEnabled(mode === 'effect');

    if (mode === 'effect') {
      // 번역 쪽 상태를 정리해 UI가 헷갈리지 않게 합니다.
      classifier.reset();
      setLivePrediction(EMPTY_PREDICTION);
    } else {
      setActiveEffect(null);
      setEffectConfidence(0);
    }
  }, [mode]);

  // ---------------------------------------------------------------------------
  // 이펙트 감지 이벤트 구독 (UI 표시용)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const detector = detectorRef.current;
    if (!detector) return;
    const offEnter = detector.events.on('enter', ({ id }) => setActiveEffect(id));
    const offExit = detector.events.on('exit', () => {
      setActiveEffect(null);
      setEffectConfidence(0);
    });
    return () => {
      offEnter();
      offExit();
    };
  }, []);

  // 신뢰도 막대는 매 프레임 갱신하면 너무 잦으므로 주기적으로만 읽습니다.
  useEffect(() => {
    if (mode !== 'effect') return;
    const timer = window.setInterval(() => {
      setEffectConfidence(detectorRef.current?.getConfidence() ?? 0);
    }, 150);
    return () => window.clearInterval(timer);
  }, [mode]);

  // ---------------------------------------------------------------------------
  // 카메라 프레임 처리
  // ---------------------------------------------------------------------------
  const handleFrame = useCallback((frame: HandFrameResult, fit: CoverFit) => {
    setHandVisible(frame.hands.length > 0);

    // --- 이펙트 모드 ---
    if (modeRef.current === 'effect') {
      // 좌표만 넘기면 EffectManager가 자체 루프에서 판정하고 그립니다.
      effectManagerRef.current?.setFrame(frame.hands, fit);
      return;
    }

    // --- 수어 번역 모드 / 사전 연습 모드 ---
    const classifier = classifierRef.current;
    const composer = composerRef.current;
    if (!classifier || !composer) return;

    const { live, commit } = classifier.process(frame.hands, frame.timestampMs);

    // 값이 실제로 바뀔 때만 상태를 갱신해 불필요한 렌더링을 줄입니다.
    setLivePrediction((prev) =>
      prev.label === live.label &&
      Math.abs(prev.confidence - live.confidence) < 0.02
        ? prev
        : live,
    );

    if (!commit) return;

    // 사전(연습) 모드에서는 강조 표시만 하고 텍스트에는 넣지 않습니다.
    if (modeRef.current === 'guide') return;

    // 확정된 결과를 한글 조합기에 넣습니다.
    if (commit.category === 'word') composer.pushWord(`${commit.label} `);
    else composer.push(commit.label);

    setText(composer.text);
    setComposing(composer.hasPending);

    // 스마트 모드가 다음에 기대할 자모 종류를 갱신합니다.
    classifier.setExpecting(composer.expecting);
    setExpecting(composer.expecting);
  }, []);

  const handleError = useCallback((err: AppError) => setError(err), []);

  /** 오류 배너의 "다시 시도" — 카메라와 모델을 처음부터 다시 붙입니다. */
  const handleRetry = useCallback(() => {
    setError(null);
    setReady(false);
    setCameraKey((k) => k + 1);
  }, []);
  const handleReady = useCallback(() => setReady(true), []);

  // ---------------------------------------------------------------------------
  // 버튼 동작
  // ---------------------------------------------------------------------------

  /** 오디오는 사용자 클릭 안에서만 활성화할 수 있습니다. */
  const unlockAudio = useCallback(() => soundRef.current?.unlock(), []);

  const handleModeChange = useCallback(
    (next: AppMode) => {
      unlockAudio();
      setMode(next);
    },
    [unlockAudio],
  );

  const handleReset = useCallback(() => {
    composerRef.current?.reset();
    classifierRef.current?.reset();
    ttsRef.current?.cancel();
    effectManagerRef.current?.clear();
    setText('');
    setComposing(false);
    setExpecting('consonant');
    setSpeaking(false);
  }, []);

  const handleBackspace = useCallback(() => {
    const composer = composerRef.current;
    if (!composer) return;
    composer.backspace();
    setText(composer.text);
    setComposing(composer.hasPending);
    classifierRef.current?.setExpecting(composer.expecting);
    setExpecting(composer.expecting);
  }, []);

  const handleSpace = useCallback(() => {
    const composer = composerRef.current;
    if (!composer) return;
    composer.space();
    setText(composer.text);
    setComposing(false);
    classifierRef.current?.setExpecting(composer.expecting);
    setExpecting(composer.expecting);
  }, []);

  /** 텍스트를 소리 내어 읽습니다. */
  const speak = useCallback(async (value: string) => {
    const tts = ttsRef.current;
    if (!tts) return;
    try {
      setSpeaking(true);
      await tts.speak(value);
      // 일부 브라우저는 'end' 이벤트를 신뢰하기 어려워서, 글자 수에 비례한
      // 여유 시간이 지나면 상태를 되돌립니다.
      window.setTimeout(
        () => setSpeaking(false),
        Math.max(1500, value.length * 220),
      );
    } catch (err) {
      setError({ kind: 'tts-unavailable', message: (err as Error).message });
      setSpeaking(false);
    }
  }, []);

  const handleSpeak = useCallback(() => {
    unlockAudio();
    // 조합 중인 글자도 읽도록 먼저 확정합니다.
    const composer = composerRef.current;
    if (composer) {
      composer.flush();
      setText(composer.text);
      setComposing(false);
      void speak(composer.text);
    }
  }, [speak, unlockAudio]);

  const handleStopSpeaking = useCallback(() => {
    ttsRef.current?.cancel();
    setSpeaking(false);
  }, []);

  const handleSaveToHistory = useCallback(() => {
    const composer = composerRef.current;
    if (!composer) return;
    composer.flush();
    setText(composer.text);
    setComposing(false);
    history.add(composer.text);
  }, [history]);

  const handleRestore = useCallback((value: string) => {
    const composer = composerRef.current;
    if (!composer) return;
    composer.setText(value);
    setText(composer.text);
    setComposing(false);
  }, []);

  const handleToggleSound = useCallback(() => {
    unlockAudio();
    setSoundOn((prev) => {
      const next = !prev;
      soundRef.current?.setEnabled(next);
      return next;
    });
  }, [unlockAudio]);

  // ---------------------------------------------------------------------------
  // 정리
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // 마운트 시점의 참조를 저장해 두어야 cleanup에서 안전하게 쓸 수 있습니다.
    const tts = ttsRef.current;
    const sound = soundRef.current;
    const manager = effectManagerRef.current;
    return () => {
      tts?.cancel();
      manager?.dispose();
      sound?.dispose();
    };
  }, []);

  // ---------------------------------------------------------------------------
  // 렌더링
  // ---------------------------------------------------------------------------
  const isEffectMode = mode === 'effect';
  const isGuideMode = mode === 'guide';
  const confidence = isEffectMode ? effectConfidence : livePrediction.confidence;
  const effectInfo = activeEffect ? EFFECT_INFO.get(activeEffect) ?? null : null;

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__title">
          <h1>한국 수화 인식기</h1>
          <p className="app__subtitle">
            웹캠으로 손동작을 인식해 한글로 바꾸고, 손 모양으로 이펙트를 발사합니다.
          </p>
        </div>
        <ModeSelector mode={mode} onChange={handleModeChange} />
      </header>

      <ErrorMessage
        error={error}
        onDismiss={() => setError(null)}
        onRetry={handleRetry}
      />

      <main className={`app__main ${isGuideMode ? 'app__main--guide' : ''}`}>
        {/* 카메라는 모드가 바뀌어도 계속 마운트해 둡니다.
            언마운트하면 카메라가 껐다 켜지면서 몇 초씩 멈추기 때문입니다.
            사전 모드에서는 작게 줄여 "연습용 창"으로 씁니다. */}
        <section className="app__camera" aria-label="실시간 카메라 미리보기">
          <CameraPreview
            key={cameraKey}
            onFrame={handleFrame}
            onError={handleError}
            onReady={handleReady}
            // 이펙트 모드에서는 뼈대를 숨겨야 이펙트가 잘 보입니다.
            showSkeleton={!isEffectMode}
          >
            <EffectCanvas
              visible={isEffectMode}
              onReady={(canvas) =>
                // 두 번째 인자는 화면 흔들림을 적용할 요소입니다.
                effectManagerRef.current?.attach(canvas, canvas.parentElement)
              }
            />
          </CameraPreview>

          {!ready && !error && (
            <div className="app__loading">카메라와 모델을 불러오는 중…</div>
          )}

          {isGuideMode && (
            <div className="app__practice-badge">연습 모드</div>
          )}
        </section>

        <aside className="app__side">
          {isGuideMode ? (
            <GuidePage
              liveLabel={livePrediction.label}
              liveEffect={activeEffect}
            />
          ) : isEffectMode ? (
            <EffectLegend activeId={activeEffect} />
          ) : (
            <>
              <KoreanTextOutput text={text} composing={composing} />
              <DictionarySelector
                value={dictionary}
                onChange={setDictionary}
                expecting={expecting}
              />
            </>
          )}
        </aside>
      </main>

      <footer className="app__controls">
        <CurrentGesture
          prediction={livePrediction}
          effect={effectInfo}
          handVisible={handVisible}
          isEffectMode={isEffectMode}
        />
        <ConfidenceIndicator confidence={confidence} />

        <div className="app__buttons">
          {isEffectMode ? (
            <>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={handleToggleSound}
                aria-pressed={soundOn}
              >
                {soundOn ? <SpeakerIcon /> : <SpeakerOffIcon />}
                {soundOn ? '효과음 켜짐' : '효과음 꺼짐'}
              </button>
              <ResetButton onReset={handleReset} label="이펙트 지우기" />
            </>
          ) : isGuideMode ? (
            <p className="app__guide-tip">
              카메라 앞에서 손 모양을 만들어 보세요. 인식되는 카드가 강조됩니다.
            </p>
          ) : (
            <>
              <SpeechButton
                text={text}
                supported={ttsSupported}
                speaking={speaking}
                onSpeak={handleSpeak}
                onStop={handleStopSpeaking}
              />
              <button
                type="button"
                className="btn btn--secondary"
                onClick={handleSpace}
                aria-label="띄어쓰기"
              >
                <SpaceIcon />
                띄어쓰기
              </button>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={handleBackspace}
                disabled={text.length === 0}
                aria-label="한 글자 지우기"
              >
                <BackspaceIcon />
                지우기
              </button>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={handleSaveToHistory}
                disabled={text.trim().length === 0}
                aria-label="현재 문장 저장"
              >
                <SaveIcon />
                저장
              </button>
              <ResetButton onReset={handleReset} disabled={text.length === 0} />
            </>
          )}
        </div>
      </footer>

      {isEffectMode ? (
        <section className="app__hint">
          <details>
            <summary>이펙트 모드 사용 팁</summary>
            <ul>
              <li>
                손 전체가 화면에 들어오도록 카메라에서 40~80cm 정도 떨어지세요.
              </li>
              <li>
                <strong>거미줄</strong>은 손 모양을 만든 순간 한 번 발사됩니다.
                손을 풀었다가 다시 만들면 재발사됩니다.
              </li>
              <li>
                <strong>에너지</strong>는 주먹을 오래 쥘수록 강해집니다. 최대
                2.2초까지 모은 뒤 손을 펴면 충격파가 터집니다.
              </li>
              <li>밝은 곳에서 배경이 단순할수록 인식이 정확합니다.</li>
            </ul>
          </details>
        </section>
      ) : (
        <div className="app__bottom">
          <HistoryPanel
            entries={history.entries}
            onSpeak={(value) => {
              unlockAudio();
              void speak(value);
            }}
            onRestore={handleRestore}
            onDelete={history.remove}
            onClearAll={history.clear}
          />
          <GestureCheatSheet />
        </div>
      )}
    </div>
  );
}

/** 인식 가능한 손 모양 목록 — 접이식 도움말. */
function GestureCheatSheet() {
  // 카테고리별로 묶어서 보여줍니다.
  const groups = [
    { key: 'consonant' as const, title: '자음 (지화)' },
    { key: 'vowel' as const, title: '모음 (지화)' },
    { key: 'word' as const, title: '단어 · 인사말' },
  ];

  return (
    <section className="cheatsheet" aria-label="인식 가능한 손 모양">
      <details>
        <summary>인식 가능한 손 모양 보기</summary>
        {groups.map((group) => (
          <div key={group.key} className="cheatsheet__group">
            <h3>{group.title}</h3>
            <ul>
              {GESTURE_RULES.filter((r) => r.category === group.key).map((rule) => (
                <li key={rule.label}>
                  {/* 이모지 대신 실제 손 모양을 그려 보여줍니다. */}
                  <HandShape shape={rule.shape} size={40} />
                  <strong className="cheatsheet__label">{rule.label}</strong>
                  <span className="cheatsheet__hint">{rule.hint}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="cheatsheet__note">
          같은 동작을 약 0.25초 유지하면 텍스트에 추가되고, 같은 동작이 연속으로
          입력되지 않도록 약 1.2초의 대기 시간이 있습니다. 자음과 모음은 손 모양이
          겹칠 수 있어 <strong>스마트</strong> 모드를 권장합니다. 뜻과 함께 자세히
          보려면 위쪽의 <strong>수어 사전</strong> 탭을 눌러보세요.
        </p>
      </details>
    </section>
  );
}
