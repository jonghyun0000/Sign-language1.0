// =============================================================================
// useResponsiveCanvas — 캔버스 해상도를 컨테이너 크기에 맞추는 훅
// =============================================================================
// 왜 필요한가?
//   <canvas>는 "CSS 크기"와 "실제 픽셀 크기(width/height 속성)"가 따로 놉니다.
//   둘을 맞추지 않으면 그림이 늘어나거나 흐릿해집니다. 게다가 레티나
//   디스플레이에서는 devicePixelRatio만큼 더 촘촘하게 그려야 선명합니다.
//
//   이 훅은 ResizeObserver로 부모 크기 변화를 감지해 캔버스 해상도를 항상
//   최신 상태로 유지합니다. 창 크기를 바꾸거나 모바일에서 화면을 회전해도
//   좌표가 어긋나지 않습니다.
//
// 중요:
//   카메라 미리보기 위에 겹쳐 놓는 캔버스들(손 골격, 이펙트)은 모두 이 훅을
//   써야 서로 크기가 정확히 일치하고, 같은 좌표 변환을 공유할 수 있습니다.

import { useEffect, useState, type RefObject } from 'react';

/** 지나치게 큰 해상도로 그리면 느려지므로 상한을 둡니다. */
const MAX_PIXEL_RATIO = 2;

export interface CanvasSize {
  width: number;
  height: number;
}

/**
 * 캔버스를 부모 요소 크기에 맞춰 자동으로 리사이즈합니다.
 *
 * @param canvasRef 크기를 맞출 캔버스
 * @returns 현재 캔버스의 실제 픽셀 크기
 */
export function useResponsiveCanvas(
  canvasRef: RefObject<HTMLCanvasElement | null>,
): CanvasSize {
  const [size, setSize] = useState<CanvasSize>({ width: 0, height: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;

    const applySize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
      const width = Math.round(parent.clientWidth * dpr);
      const height = Math.round(parent.clientHeight * dpr);
      if (width === 0 || height === 0) return;
      // 값이 바뀔 때만 대입합니다. 캔버스 크기를 다시 쓰면 내용이 지워지므로
      // 매 프레임 대입하면 깜빡입니다.
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        setSize({ width, height });
      }
    };

    applySize();

    const observer = new ResizeObserver(applySize);
    observer.observe(parent);
    // 모니터를 옮기면 devicePixelRatio가 달라질 수 있어 창 이벤트도 듣습니다.
    window.addEventListener('resize', applySize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', applySize);
    };
  }, [canvasRef]);

  return size;
}
