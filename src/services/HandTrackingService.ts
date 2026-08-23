// =============================================================================
// HandTrackingService — wraps MediaPipe HandLandmarker
// =============================================================================
// Responsibilities:
//   * Load the MediaPipe wasm fileset + the hand-landmark model (once).
//   * Run detection on a <video> element in a request-animation-frame loop.
//   * Fire a callback with normalized landmarks every frame.
//
// Why a class?
//   * It owns mutable state (the model, the RAF loop) and we want clean
//     start()/stop() lifecycle hooks that React effects can call.
//
// Beginners: MediaPipe's Tasks API loads its WASM runtime and ML model from
// a CDN at runtime. The first run does a one-time download (~3 MB), then
// frames after that are very fast.

import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from '@mediapipe/tasks-vision';

import type { HandFrameResult, Handedness } from '../types';

/** CDN root for the wasm fileset that powers @mediapipe/tasks-vision. */
const WASM_BASE =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';

/** Public-hosted HandLandmarker model — same one MediaPipe samples use. */
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export type HandFrameCallback = (frame: HandFrameResult) => void;

export class HandTrackingService {
  private landmarker: HandLandmarker | null = null;
  private rafId: number | null = null;
  private running = false;
  private lastVideoTimeMs = -1;

  /**
   * Loads the model. Call once before `start()`. Safe to call multiple times —
   * subsequent calls resolve immediately.
   */
  async init(): Promise<void> {
    if (this.landmarker) return;
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
    this.landmarker = await HandLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
  }

  /**
   * Begins the detect loop against the given <video> element.
   * Caller is responsible for assigning a MediaStream to `video.srcObject`
   * and awaiting `video.play()` before calling this.
   */
  start(video: HTMLVideoElement, onFrame: HandFrameCallback): void {
    if (!this.landmarker) {
      throw new Error('HandTrackingService.init() must be awaited before start()');
    }
    if (this.running) return;
    this.running = true;

    const tick = () => {
      if (!this.running || !this.landmarker) return;
      // Skip duplicate frames: MediaPipe wants strictly increasing timestamps.
      if (video.readyState >= 2 && video.currentTime !== this.lastVideoTimeMs) {
        this.lastVideoTimeMs = video.currentTime;
        const nowMs = performance.now();
        let result: HandLandmarkerResult | undefined;
        try {
          result = this.landmarker.detectForVideo(video, nowMs);
        } catch (err) {
          // Detection can throw if the video element is briefly not ready
          // (e.g. tab switch). Swallow and keep looping.
          console.warn('HandLandmarker.detectForVideo threw:', err);
        }
        if (result) {
          onFrame({
            hands: result.landmarks ?? [],
            handedness: (result.handedness ?? []).map(
              (h) => (h[0]?.categoryName as Handedness) ?? 'Right',
            ),
            timestampMs: nowMs,
          });
        }
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  /** Stops the RAF loop. Leaves the model loaded so we can `start()` again. */
  stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.lastVideoTimeMs = -1;
  }

  /** Tear-down for full disposal — call from React cleanup if unmounting. */
  dispose(): void {
    this.stop();
    this.landmarker?.close();
    this.landmarker = null;
  }
}
