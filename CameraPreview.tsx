/**
 * CameraPreview 컴포넌트
 * Camera Preview Component
 *
 * 웹캠 영상을 표시하고, 감지된 손의 랜드마크를 캔버스 위에 오버레이합니다.
 * Displays webcam video and overlays detected hand landmarks on canvas.
 */

import { forwardRef, useEffect, useRef } from 'react';
import { HandTrackingResult } from '../types';

interface CameraPreviewProps {
  trackingResult: HandTrackingResult | null;
  isInitializing: boolean;
}

// MediaPipe 손 연결 정보 (어떤 랜드마크끼리 선으로 이을지)
// MediaPipe hand connections (which landmarks to connect with lines)
const HAND_CONNECTIONS: Array<[number, number]> = [
  // 엄지 / Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // 검지 / Index
  [0, 5], [5, 6], [6, 7], [7, 8],
  // 중지 / Middle
  [5, 9], [9, 10], [10, 11], [11, 12],
  // 약지 / Ring
  [9, 13], [13, 14], [14, 15], [15, 16],
  // 소지 / Pinky
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

export const CameraPreview = forwardRef<HTMLVideoElement, CameraPreviewProps>(
  ({ trackingResult, isInitializing }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    /**
     * 손 랜드마크를 캔버스에 그립니다.
     * Draw hand landmarks on canvas.
     */
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 이전 프레임 지우기 / Clear previous frame
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!trackingResult || trackingResult.landmarks.length === 0) return;

      // 각 손에 대해 그리기 / Draw for each hand
      trackingResult.landmarks.forEach((handLandmarks, handIndex) => {
        // 손마다 색깔 다르게 (왼손/오른손 구분)
        // Different color per hand (left/right distinction)
        const isLeft = trackingResult.handedness[handIndex]?.categoryName === 'Left';
        const connectionColor = isLeft ? '#f97316' : '#06b6d4'; // 주황 / 청록 (orange / cyan)
        const pointColor = isLeft ? '#fb923c' : '#22d3ee';

        // 1. 연결선 그리기 / Draw connections
        ctx.strokeStyle = connectionColor;
        ctx.lineWidth = 3;
        HAND_CONNECTIONS.forEach(([start, end]) => {
          const startPoint = handLandmarks[start];
          const endPoint = handLandmarks[end];
          if (!startPoint || !endPoint) return;

          ctx.beginPath();
          // 좌우 반전 처리 (1 - x): 거울처럼 보이도록
          // Horizontal flip (1 - x): so it appears like a mirror
          ctx.moveTo((1 - startPoint.x) * canvas.width, startPoint.y * canvas.height);
          ctx.lineTo((1 - endPoint.x) * canvas.width, endPoint.y * canvas.height);
          ctx.stroke();
        });

        // 2. 랜드마크 점 그리기 / Draw landmark points
        ctx.fillStyle = pointColor;
        handLandmarks.forEach((landmark) => {
          ctx.beginPath();
          ctx.arc(
            (1 - landmark.x) * canvas.width,
            landmark.y * canvas.height,
            5,
            0,
            2 * Math.PI
          );
          ctx.fill();
        });
      });
    }, [trackingResult]);

    /**
     * 비디오 로드 후 캔버스 크기를 비디오 크기에 맞춤
     * Match canvas size to video size after video loads
     */
    useEffect(() => {
      const video = (ref as React.RefObject<HTMLVideoElement>)?.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      const handleLoaded = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      };

      video.addEventListener('loadedmetadata', handleLoaded);
      return () => video.removeEventListener('loadedmetadata', handleLoaded);
    }, [ref]);

    return (
      <div className="camera-preview">
        <div className="camera-frame">
          <video
            ref={ref}
            className="camera-video"
            playsInline
            muted
            autoPlay
          />
          <canvas ref={canvasRef} className="camera-canvas" />

          {isInitializing && (
            <div className="camera-loading">
              <div className="loading-spinner" />
              <p>카메라 및 모델 준비 중...</p>
            </div>
          )}
        </div>
      </div>
    );
  }
);

CameraPreview.displayName = 'CameraPreview';
