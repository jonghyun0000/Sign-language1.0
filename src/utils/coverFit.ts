// =============================================================================
// coverFit — 랜드마크(0~1)를 화면 픽셀 좌표로 정확히 변환
// =============================================================================
// 문제 상황:
//   <video>는 CSS `object-fit: cover`로 그려집니다. 즉 컨테이너 비율과 카메라
//   비율이 다르면 영상의 일부가 잘려 나갑니다. 그런데 랜드마크는 "잘리기 전"
//   영상 기준의 0~1 좌표이기 때문에, 단순히 `x * canvasWidth`로 계산하면
//   손 위치와 이펙트가 어긋납니다.
//
// 해결:
//   cover 규칙(가로/세로 중 더 크게 확대되는 배율을 선택하고 가운데 정렬)을
//   그대로 재현해서 좌표를 옮깁니다.
//
// 거울(mirror) 처리:
//   셀카처럼 보이도록 <video>는 CSS `transform: scaleX(-1)`로 좌우 반전합니다.
//   캔버스까지 CSS로 반전시키면 캔버스에 그리는 글자도 뒤집히므로, 캔버스는
//   반전하지 않고 대신 좌표 계산에서 x를 뒤집습니다(`1 - x`).

import type { Landmark } from '../types';

export interface CoverFit {
  /** 영상 → 컨테이너 확대 배율. */
  scale: number;
  /** 가운데 정렬로 생기는 좌측 여백(음수면 잘려나간 양). */
  offsetX: number;
  /** 가운데 정렬로 생기는 상단 여백. */
  offsetY: number;
  /** 원본 영상 크기. */
  mediaWidth: number;
  mediaHeight: number;
}

/**
 * `object-fit: cover` 배치를 계산합니다.
 *
 * @param containerW 화면에 보이는 영역의 CSS 픽셀 너비
 * @param containerH 화면에 보이는 영역의 CSS 픽셀 높이
 * @param mediaW     카메라 영상의 실제 픽셀 너비 (video.videoWidth)
 * @param mediaH     카메라 영상의 실제 픽셀 높이 (video.videoHeight)
 */
export function computeCoverFit(
  containerW: number,
  containerH: number,
  mediaW: number,
  mediaH: number,
): CoverFit {
  // 안전장치: 영상 크기를 아직 모르면 1:1로 둡니다.
  if (!mediaW || !mediaH) {
    return {
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      mediaWidth: containerW || 1,
      mediaHeight: containerH || 1,
    };
  }
  // cover = 두 축 중 "더 크게" 확대해야 하는 쪽을 따릅니다(빈틈 없이 채우기).
  const scale = Math.max(containerW / mediaW, containerH / mediaH);
  const drawnW = mediaW * scale;
  const drawnH = mediaH * scale;
  return {
    scale,
    offsetX: (containerW - drawnW) / 2,
    offsetY: (containerH - drawnH) / 2,
    mediaWidth: mediaW,
    mediaHeight: mediaH,
  };
}

/** 화면 픽셀 좌표 한 점. */
export interface Point2D {
  x: number;
  y: number;
}

/**
 * 정규화 랜드마크 → 캔버스 픽셀 좌표.
 * `mirror`가 true면 셀카 화면과 동일하게 좌우를 뒤집습니다.
 */
export function projectLandmark(
  lm: Landmark,
  fit: CoverFit,
  mirror = true,
): Point2D {
  const nx = mirror ? 1 - lm.x : lm.x;
  return {
    x: fit.offsetX + nx * fit.mediaWidth * fit.scale,
    y: fit.offsetY + lm.y * fit.mediaHeight * fit.scale,
  };
}

/** 손 전체(21점)를 한 번에 변환합니다. */
export function projectHand(
  hand: Landmark[],
  fit: CoverFit,
  mirror = true,
): Point2D[] {
  return hand.map((lm) => projectLandmark(lm, fit, mirror));
}

/**
 * 정규화 거리(0~1 공간) → 픽셀 거리.
 * 손 크기에 비례하는 이펙트 크기를 계산할 때 씁니다.
 */
export function scaleLength(normalizedLength: number, fit: CoverFit): number {
  return normalizedLength * fit.mediaWidth * fit.scale;
}
