// =============================================================================
// CameraPreview — 카메라와 손 추적을 담당하는 컴포넌트
// =============================================================================
// 하는 일:
//   1. 마운트되면 카메라 권한을 요청합니다.
//   2. 카메라 영상을 <video>에 연결합니다.
//   3. HandTrackingService로 MediaPipe를 띄우고 추적 루프를 시작합니다.
//   4. 손 골격을 캔버스에 겹쳐 그려 시각적 피드백을 줍니다.
//   5. 매 프레임 `onFrame`으로 결과와 좌표 변환 정보를 부모에게 넘깁니다.
//
// children으로 이펙트 캔버스를 겹칠 수 있게 열어 두었습니다.

import { useEffect, useRef, type ReactNode } from 'react';

import { HandTrackingService } from '../services/HandTrackingService';
import { useResponsiveCanvas } from '../hooks/useResponsiveCanvas';
import { computeCoverFit, projectHand, type CoverFit } from '../utils/coverFit';
import type { AppError, HandFrameResult } from '../types';

interface Props {
  /** 매 프레임 호출 — 손 좌표와 화면 좌표 변환 정보를 함께 넘깁니다. */
  onFrame: (frame: HandFrameResult, fit: CoverFit) => void;
  onError: (err: AppError) => void;
  onReady: () => void;
  /** 손 골격(뼈대) 오버레이를 그릴지. 이펙트 모드에서는 끄는 편이 깔끔합니다. */
  showSkeleton?: boolean;
  /** 카메라 위에 겹칠 요소 (이펙트 캔버스 등). */
  children?: ReactNode;
}

/** 손 골격을 그릴 때 이을 랜드마크 쌍. */
const HAND_CONNECTIONS: ReadonlyArray<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],           // 엄지
  [0, 5], [5, 6], [6, 7], [7, 8],           // 검지
  [5, 9], [9, 10], [10, 11], [11, 12],      // 중지
  [9, 13], [13, 14], [14, 15], [15, 16],    // 약지
  [13, 17], [17, 18], [18, 19], [19, 20],   // 새끼
  [0, 17],                                   // 손바닥 아래쪽
];

export function CameraPreview({
  onFrame,
  onError,
  onReady,
  showSkeleton = true,
  children,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 캔버스 해상도를 컨테이너에 맞춰 자동 조정합니다.
  useResponsiveCanvas(canvasRef);

  // 콜백을 ref에 담아두면, 부모가 리렌더돼도 아래 effect가 다시 실행되지
  // 않습니다(카메라가 껐다 켜지는 것을 막습니다).
  const onFrameRef = useRef(onFrame);
  const onErrorRef = useRef(onError);
  const onReadyRef = useRef(onReady);
  const showSkeletonRef = useRef(showSkeleton);
  onFrameRef.current = onFrame;
  onErrorRef.current = onError;
  onReadyRef.current = onReady;
  showSkeletonRef.current = showSkeleton;

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    const service = new HandTrackingService();

    const start = async () => {
      // --- 1. 카메라 권한 요청 ---
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: 'user' },
          audio: false,
        });
      } catch (err) {
        const isDenied =
          err instanceof DOMException &&
          (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError');
        onErrorRef.current({
          kind: isDenied ? 'camera-permission' : 'camera-unavailable',
          message: isDenied
            ? '카메라 권한이 거부되었습니다. 브라우저 주소창의 카메라 아이콘에서 권한을 허용한 뒤 새로고침해 주세요.'
            : `카메라를 사용할 수 없습니다: ${(err as Error).message}`,
        });
        return;
      }
      if (cancelled || !videoRef.current) return;

      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();

      // --- 2. MediaPipe 모델 로드 ---
      try {
        await service.init();
      } catch (err) {
        onErrorRef.current({
          kind: 'model-load',
          message: `손 인식 모델을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요. (${(err as Error).message})`,
        });
        return;
      }
      if (cancelled) return;

      onReadyRef.current();

      // --- 3. 추적 루프 시작 ---
      service.start(video, (frame) => {
        const canvas = canvasRef.current;
        // 캔버스 픽셀 크기와 영상 원본 크기로 좌표 변환 규칙을 계산합니다.
        const fit = computeCoverFit(
          canvas?.width ?? 0,
          canvas?.height ?? 0,
          video.videoWidth,
          video.videoHeight,
        );
        if (showSkeletonRef.current) drawSkeleton(canvas, frame, fit);
        else clearCanvas(canvas);
        onFrameRef.current(frame, fit);
      });
    };

    void start();

    return () => {
      cancelled = true;
      service.dispose();
      // 카메라 표시등이 꺼지도록 트랙을 반드시 정지합니다.
      if (stream) for (const track of stream.getTracks()) track.stop();
    };
  }, []);

  return (
    <div className="camera-preview">
      {/* 셀카처럼 보이도록 영상만 좌우 반전합니다.
          캔버스는 반전하지 않고 좌표 계산에서 x를 뒤집습니다
          (캔버스를 반전하면 그 안에 그리는 글자까지 뒤집히기 때문). */}
      <video ref={videoRef} className="camera-preview__video" playsInline muted />
      <canvas ref={canvasRef} className="camera-preview__canvas" />
      {children}
    </div>
  );
}

/** 캔버스를 비웁니다. */
function clearCanvas(canvas: HTMLCanvasElement | null): void {
  const ctx = canvas?.getContext('2d');
  if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/** 손 골격을 영상 위에 그립니다. */
function drawSkeleton(
  canvas: HTMLCanvasElement | null,
  frame: HandFrameResult,
  fit: CoverFit,
): void {
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const hand of frame.hands) {
    // 정규화 좌표를 화면 픽셀로 변환 (거울 반전 포함).
    const pts = projectHand(hand, fit);

    // --- 뼈대 ---
    ctx.lineWidth = Math.max(2, canvas.width * 0.0025);
    ctx.strokeStyle = 'rgba(99, 179, 237, 0.95)';
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const [a, b] of HAND_CONNECTIONS) {
      ctx.moveTo(pts[a].x, pts[a].y);
      ctx.lineTo(pts[b].x, pts[b].y);
    }
    ctx.stroke();

    // --- 관절 점 ---
    const dotSize = Math.max(3, canvas.width * 0.0035);
    ctx.fillStyle = 'rgba(245, 101, 101, 0.95)';
    for (const p of pts) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, dotSize, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
