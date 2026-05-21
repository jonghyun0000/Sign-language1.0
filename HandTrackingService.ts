/**
 * MediaPipe Hand 추적 서비스
 * MediaPipe Hand Tracking Service
 *
 * MediaPipe Tasks Vision을 사용하여 웹캠 영상에서 양손의 21개 랜드마크를 실시간으로 감지합니다.
 * Uses MediaPipe Tasks Vision to detect 21 landmarks of both hands in real-time from webcam.
 */

import {
  HandLandmarker,
  FilesetResolver,
  HandLandmarkerResult,
} from '@mediapipe/tasks-vision';
import { HandTrackingResult } from '../types';

export class HandTrackingService {
  private handLandmarker: HandLandmarker | null = null;
  private isInitialized = false;

  /**
   * MediaPipe Hand Landmarker 초기화
   * Initialize the MediaPipe Hand Landmarker
   *
   * WASM 파일과 모델 파일을 CDN에서 로드합니다.
   * Loads WASM files and model from CDN.
   */
  async initialize(): Promise<void> {
    try {
      // FilesetResolver: MediaPipe가 사용하는 WASM 파일을 로드합니다.
      // FilesetResolver: Loads the WASM files used by MediaPipe.
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );

      // HandLandmarker 생성 - 최대 2개의 손을 감지하도록 설정
      // Create HandLandmarker - configured to detect up to 2 hands
      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU', // GPU 가속 사용 / Use GPU acceleration
        },
        runningMode: 'VIDEO', // 비디오 스트림 모드 / Video stream mode
        numHands: 2, // 양손 감지 / Detect both hands
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      this.isInitialized = true;
    } catch (error) {
      console.error('MediaPipe 초기화 실패 / MediaPipe initialization failed:', error);
      throw new Error('MediaPipe Hand Landmarker를 초기화할 수 없습니다.');
    }
  }

  /**
   * 비디오 프레임에서 손 랜드마크 감지
   * Detect hand landmarks from a video frame
   *
   * @param videoElement - 웹캠 비디오 엘리먼트 / Webcam video element
   * @param timestamp - 현재 프레임 타임스탬프(ms) / Current frame timestamp (ms)
   * @returns 감지된 손의 랜드마크 결과 / Detected hand landmark result
   */
  detectForVideo(
    videoElement: HTMLVideoElement,
    timestamp: number
  ): HandTrackingResult | null {
    if (!this.handLandmarker || !this.isInitialized) {
      return null;
    }

    try {
      const result: HandLandmarkerResult = this.handLandmarker.detectForVideo(
        videoElement,
        timestamp
      );

      // 결과를 우리 앱의 타입 형식으로 변환
      // Convert result to our app's type format
      return {
        landmarks: result.landmarks || [],
        handedness:
          result.handedness?.map((h) => ({
            categoryName: h[0]?.categoryName as 'Left' | 'Right',
            score: h[0]?.score ?? 0,
          })) || [],
      };
    } catch (error) {
      console.error('손 감지 오류 / Hand detection error:', error);
      return null;
    }
  }

  /**
   * 리소스 정리
   * Clean up resources
   */
  close(): void {
    if (this.handLandmarker) {
      this.handLandmarker.close();
      this.handLandmarker = null;
      this.isInitialized = false;
    }
  }

  get ready(): boolean {
    return this.isInitialized;
  }
}
