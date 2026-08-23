// =============================================================================
// EffectCanvas — 파티클 이펙트를 그리는 투명 캔버스
// =============================================================================
// 카메라 영상 위에 겹쳐지는 레이어입니다. 직접 그리지는 않고, 캔버스 엘리먼트를
// EffectManager에 넘겨주면 매니저가 자신의 애니메이션 루프에서 그립니다.
//
// 크기는 useResponsiveCanvas가 부모(카메라 컨테이너)에 맞춰 자동 조정합니다.

import { useEffect, useRef } from 'react';

import { useResponsiveCanvas } from '../hooks/useResponsiveCanvas';

interface Props {
  /** 캔버스가 준비되면 호출됩니다. EffectManager.attach를 연결하세요. */
  onReady: (canvas: HTMLCanvasElement) => void;
  /** 이펙트 모드가 아닐 때는 숨깁니다. */
  visible: boolean;
}

export function EffectCanvas({ onReady, visible }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useResponsiveCanvas(canvasRef);

  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    if (canvasRef.current) onReadyRef.current(canvasRef.current);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="effect-canvas"
      // display:none으로 숨기면 크기가 0이 되어 좌표가 깨지므로
      // 투명도로만 숨깁니다.
      style={{ opacity: visible ? 1 : 0 }}
      aria-hidden="true"
    />
  );
}
