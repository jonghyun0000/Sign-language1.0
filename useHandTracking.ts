/**
 * 손 추적 및 제스처 인식을 관리하는 커스텀 훅
 * Custom hook to manage hand tracking and gesture recognition
 *
 * 이 훅은 다음 책임을 가집니다 / This hook is responsible for:
 *  1. MediaPipe 초기화 / MediaPipe initialization
 *  2. requestAnimationFrame 기반 인식 루프 실행 / Run rAF-based recognition loop
 *  3. 디바운싱 적용 (같은 제스처 반복 방지) / Apply debouncing (prevent repeats)
 *  4. 인식된 텍스트 누적 / Accumulate recognized text
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { GestureClassifier } from '../services/GestureClassifier';
import { HandTrackingService } from '../services/HandTrackingService';
import { AppError, GestureResult, HandTrackingResult } from '../types';

interface UseHandTrackingOptions {
  videoRef: React.RefObject<HTMLVideoElement>;
  // 같은 제스처가 다시 인식되기까지 필요한 최소 시간(ms)
  // Minimum time before same gesture can be recognized again (ms)
  debounceMs?: number;
  // 텍스트에 추가하기 전 제스처가 안정적으로 유지되어야 하는 시간(ms)
  // Time gesture must remain stable before being added to text (ms)
  confirmationMs?: number;
  enabled?: boolean;
}

interface UseHandTrackingReturn {
  isInitializing: boolean;
  isTracking: boolean;
  currentGesture: GestureResult;
  recognizedText: string;
  trackingResult: HandTrackingResult | null;
  error: AppError | null;
  clearText: () => void;
  start: () => Promise<void>;
  stop: () => void;
}

export function useHandTracking({
  videoRef,
  debounceMs = 1500,
  confirmationMs = 800,
  enabled = true,
}: UseHandTrackingOptions): UseHandTrackingReturn {
  // 상태들 / States
  const [isInitializing, setIsInitializing] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [currentGesture, setCurrentGesture] = useState<GestureResult>({
    gesture: '',
    confidence: 0,
    type: 'none',
  });
  const [recognizedText, setRecognizedText] = useState('');
  const [trackingResult, setTrackingResult] = useState<HandTrackingResult | null>(null);
  const [error, setError] = useState<AppError | null>(null);

  // 서비스 인스턴스 (재생성 방지를 위해 ref 사용)
  // Service instances (use refs to avoid recreation)
  const handServiceRef = useRef<HandTrackingService | null>(null);
  const classifierRef = useRef<GestureClassifier | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // 디바운싱과 확인 시스템을 위한 ref들
  // Refs for debouncing and confirmation system
  const lastAddedGestureRef = useRef<string>(''); // 마지막으로 추가된 제스처 / Last added gesture
  const lastAddedTimeRef = useRef<number>(0); // 마지막 추가 시각 / Last added time
  const pendingGestureRef = useRef<string>(''); // 확인 대기 중인 제스처 / Gesture pending confirmation
  const pendingStartTimeRef = useRef<number>(0); // 대기 시작 시각 / Start time of pending

  /**
   * 인식 루프: 매 프레임마다 실행되어 손을 감지하고 제스처를 분류합니다.
   * Recognition loop: Runs every frame to detect hands and classify gestures.
   */
  const detectLoop = useCallback(() => {
    if (!videoRef.current || !handServiceRef.current || !classifierRef.current) {
      return;
    }

    const video = videoRef.current;

    // 비디오가 충분히 로드되었을 때만 처리
    // Only process when video is sufficiently loaded
    if (video.readyState >= 2) {
      const now = performance.now();
      const result = handServiceRef.current.detectForVideo(video, now);

      if (result) {
        setTrackingResult(result);

        const gestureResult = classifierRef.current.classify(result);
        setCurrentGesture(gestureResult);

        // 제스처 확인 시스템:
        // 1. 새로운 제스처가 감지되면 대기 시작
        // 2. confirmationMs 동안 같은 제스처가 유지되면 텍스트에 추가
        // 3. 마지막 추가 후 debounceMs 시간이 지나야 같은 제스처 재추가 가능
        //
        // Gesture confirmation system:
        // 1. Start waiting when new gesture detected
        // 2. Add to text if same gesture maintained for confirmationMs
        // 3. Same gesture can only be re-added after debounceMs has passed
        if (gestureResult.gesture && gestureResult.confidence >= 0.85) {
          if (pendingGestureRef.current !== gestureResult.gesture) {
            // 다른 제스처가 시작됨: 대기 타이머 리셋
            // Different gesture started: reset waiting timer
            pendingGestureRef.current = gestureResult.gesture;
            pendingStartTimeRef.current = now;
          } else {
            // 같은 제스처가 유지됨: 확인 시간 경과 확인
            // Same gesture maintained: check confirmation time elapsed
            const heldTime = now - pendingStartTimeRef.current;
            const timeSinceLastAdd = now - lastAddedTimeRef.current;
            const isSameAsLast = lastAddedGestureRef.current === gestureResult.gesture;

            if (
              heldTime >= confirmationMs &&
              (!isSameAsLast || timeSinceLastAdd >= debounceMs)
            ) {
              // 텍스트에 추가 / Add to text
              setRecognizedText((prev) => prev + gestureResult.gesture);
              lastAddedGestureRef.current = gestureResult.gesture;
              lastAddedTimeRef.current = now;
              // 한 번 추가했으면 즉시 다음 제스처를 기다림 (재 진입 방지)
              // After adding, immediately wait for next gesture (prevent re-entry)
              pendingGestureRef.current = '';
            }
          }
        } else {
          // 인식되지 않으면 대기 상태 해제
          // If not recognized, clear pending state
          pendingGestureRef.current = '';
        }
      }
    }

    animationFrameRef.current = requestAnimationFrame(detectLoop);
  }, [videoRef, confirmationMs, debounceMs]);

  /**
   * 추적 시작: 카메라 권한 요청, 스트림 연결, 인식 루프 시작
   * Start tracking: request camera permission, connect stream, start recognition loop
   */
  const start = useCallback(async () => {
    if (isTracking || isInitializing) return;

    setIsInitializing(true);
    setError(null);

    try {
      // 1. 카메라 권한 요청 / Request camera permission
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user', // 전면 카메라 / Front camera
          },
          audio: false,
        });
      } catch (camErr) {
        const message =
          camErr instanceof Error && camErr.name === 'NotAllowedError'
            ? '카메라 접근 권한이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용해주세요.'
            : '카메라를 사용할 수 없습니다. 카메라가 다른 프로그램에서 사용 중인지 확인해주세요.';
        setError({ type: 'camera', message });
        setIsInitializing(false);
        return;
      }

      // 2. 비디오 엘리먼트에 스트림 연결 / Connect stream to video element
      if (!videoRef.current) {
        throw new Error('비디오 엘리먼트가 준비되지 않았습니다.');
      }
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      // 3. MediaPipe 초기화 / Initialize MediaPipe
      if (!handServiceRef.current) {
        handServiceRef.current = new HandTrackingService();
      }
      if (!classifierRef.current) {
        classifierRef.current = new GestureClassifier();
      }

      try {
        await handServiceRef.current.initialize();
      } catch {
        setError({
          type: 'mediapipe',
          message:
            'MediaPipe 모델을 로드할 수 없습니다. 인터넷 연결을 확인하고 새로고침해주세요.',
        });
        setIsInitializing(false);
        return;
      }

      // 4. 추적 루프 시작 / Start tracking loop
      setIsTracking(true);
      setIsInitializing(false);
      animationFrameRef.current = requestAnimationFrame(detectLoop);
    } catch (err) {
      setError({
        type: 'unknown',
        message: err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.',
      });
      setIsInitializing(false);
    }
  }, [isTracking, isInitializing, videoRef, detectLoop]);

  /**
   * 추적 중지: 카메라 스트림 해제 및 루프 정지
   * Stop tracking: release camera stream and stop loop
   */
  const stop = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }

    handServiceRef.current?.close();
    handServiceRef.current = null;
    setIsTracking(false);
    setTrackingResult(null);
    setCurrentGesture({ gesture: '', confidence: 0, type: 'none' });
  }, [videoRef]);

  /**
   * 인식된 텍스트 초기화 / Clear recognized text
   */
  const clearText = useCallback(() => {
    setRecognizedText('');
    lastAddedGestureRef.current = '';
    lastAddedTimeRef.current = 0;
    pendingGestureRef.current = '';
  }, []);

  // enabled가 true이면 자동 시작, 컴포넌트 언마운트 시 정리
  // Auto-start if enabled, cleanup on unmount
  useEffect(() => {
    if (enabled) {
      start();
    }
    return () => {
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    isInitializing,
    isTracking,
    currentGesture,
    recognizedText,
    trackingResult,
    error,
    clearText,
    start,
    stop,
  };
}
