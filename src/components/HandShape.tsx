// =============================================================================
// HandShape — 손 모양을 SVG 그림으로 그리는 컴포넌트 (이모지 대체)
// =============================================================================
// 왜 이모지를 쓰지 않나요?
//   이모지는 기기와 폰트마다 생김새가 완전히 다릅니다. 🤟 하나만 해도 애플,
//   구글, 윈도우에서 손가락 각도가 제각각이라 "정확히 이 손 모양을 만드세요"를
//   전달할 수 없습니다. 게다가 ㅏ와 ㅓ처럼 방향만 다른 손 모양은 이모지로는
//   아예 표현이 불가능합니다.
//
// 해결:
//   손 모양을 데이터(GestureShape)로 서술하고, 이 컴포넌트가 그 데이터를 보고
//   직접 그립니다. 분류기 규칙과 그림이 같은 데이터를 공유하므로 "설명과 실제
//   인식이 다른" 문제가 생길 수 없습니다.
//
// 그리는 방식:
//   손바닥(둥근 사각형) 위에 손가락 5개를 캡슐 모양으로 얹습니다.
//   * 편 손가락   = 길고 진한 캡슐
//   * 접은 손가락 = 짧고 흐린 캡슐
//   방향은 손바닥 중심을 기준으로 전체를 회전시켜 표현합니다.

import type { GestureShape, ShapeDirection } from '../types';

interface Props {
  shape: GestureShape;
  /** 그림 크기(px). 기본 64. */
  size?: number;
  /** 강조 표시(현재 인식 중일 때). */
  active?: boolean;
  className?: string;
}

/** SVG 좌표계 기준값 — 손 하나가 차지하는 영역. */
const VIEW = { width: 100, height: 116 };
/** 손바닥 중심 — 회전의 기준점입니다. */
const PALM = { x: 50, y: 74 };

/** 네 손가락의 뿌리(관절) 위치와 길이. 새끼손가락이 가장 짧습니다. */
const FINGERS = [
  { key: 'index' as const, x: 33, length: 40 },
  { key: 'middle' as const, x: 45, length: 46 },
  { key: 'ring' as const, x: 57, length: 40 },
  { key: 'pinky' as const, x: 68, length: 31 },
];

/** 손가락 뿌리의 y좌표 (손바닥 윗변). */
const KNUCKLE_Y = 56;
/** 접은 손가락이 보이는 길이. */
const CURLED_LENGTH = 11;

/** 방향별 회전 각도(도). SVG는 y축이 아래를 향하므로 시계 방향이 양수입니다. */
const ROTATION: Record<ShapeDirection, number> = {
  up: 0,
  right: 90,
  down: 180,
  left: -90,
};

export function HandShape({ shape, size = 64, active = false, className }: Props) {
  const twoHands = shape.hands === 2;
  // 두 손이면 가로로 두 배 넓은 화면이 필요합니다.
  const viewWidth = twoHands ? VIEW.width * 2 : VIEW.width;

  return (
    <svg
      className={`hand-shape ${active ? 'hand-shape--active' : ''} ${className ?? ''}`}
      width={twoHands ? size * 1.7 : size}
      height={size}
      viewBox={`0 0 ${viewWidth} ${VIEW.height}`}
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      {twoHands ? (
        <>
          {/* 왼손: 손끝이 서로 마주보도록 좌우 반전합니다. */}
          <g transform={`translate(${VIEW.width}, 0) scale(-1, 1)`}>
            <SingleHand shape={shape} />
          </g>
          <g transform={`translate(${VIEW.width}, 0)`}>
            <SingleHand shape={shape} />
          </g>
        </>
      ) : (
        <SingleHand shape={shape} />
      )}
    </svg>
  );
}

/** 손 하나를 그립니다. */
function SingleHand({ shape }: { shape: GestureShape }) {
  const direction = shape.direction ?? 'up';
  const angle = ROTATION[direction];
  // 맞댄 손(하트)은 안쪽으로 살짝 기울여야 자연스럽습니다.
  const tilt = shape.joined ? -22 : 0;

  return (
    <g transform={`rotate(${angle + tilt} ${PALM.x} ${PALM.y})`}>
      {/* --- 손목 --- */}
      <rect
        x={PALM.x - 15}
        y={PALM.y + 20}
        width={30}
        height={20}
        rx={9}
        className="hand-shape__wrist"
      />

      {/* --- 손바닥 --- */}
      <rect
        x={PALM.x - 24}
        y={PALM.y - 20}
        width={48}
        height={44}
        rx={14}
        className="hand-shape__palm"
      />

      {/* --- 엄지 --- */}
      <Thumb extended={shape.fingers.thumb} pinch={shape.pinch} />

      {/* --- 네 손가락 --- */}
      {FINGERS.map((finger) => {
        // 핀치(동그라미)에 참여하는 손가락은 따로 그립니다.
        if (shape.pinch === finger.key) return null;

        // 붙임/벌림에 따라 손가락을 좌우로 조금 옮깁니다.
        // ㄷ(붙임)과 ㅅ(벌림)처럼 간격이 의미를 가르는 경우를 표현합니다.
        let offset = 0;
        if (shape.spread && (finger.key === 'index' || finger.key === 'middle')) {
          const pull = shape.spread === 'narrow' ? 4 : -7;
          offset = finger.key === 'index' ? pull : -pull;
        }

        return (
          <Finger
            key={finger.key}
            x={finger.x + offset}
            length={finger.length}
            extended={shape.fingers[finger.key]}
            // 꺾인 검지는 ㄱ의 핵심 특징이고,
            // 갈퀴형(claw)은 네 손가락을 모두 첫마디만 폅니다.
            bent={
              (Boolean(shape.bent) && finger.key === 'index') || Boolean(shape.claw)
            }
          />
        );
      })}

      {/* --- 엄지와 맞닿아 만드는 동그라미 --- */}
      {shape.pinch && <PinchRing target={shape.pinch} />}
    </g>
  );
}

/** 손가락 하나 — 펴면 길고 진하게, 접으면 짧고 흐리게. */
function Finger({
  x,
  length,
  extended,
  bent = false,
}: {
  x: number;
  length: number;
  extended: boolean;
  /** 갈고리처럼 직각으로 꺾인 상태 (ㄱ). */
  bent?: boolean;
}) {
  // 꺾인 손가락: 위로 조금 올라가다 옆으로 꺾이는 'ㄱ' 모양 선으로 그립니다.
  if (extended && bent) {
    const half = length * 0.55;
    return (
      <path
        d={`M ${x} ${KNUCKLE_Y} V ${KNUCKLE_Y - half} H ${x - half}`}
        className="hand-shape__finger-bent"
        fill="none"
      />
    );
  }

  const drawn = extended ? length : CURLED_LENGTH;
  return (
    <rect
      x={x - 5.5}
      y={KNUCKLE_Y - drawn}
      width={11}
      height={drawn + 12}
      rx={5.5}
      className={
        extended ? 'hand-shape__finger' : 'hand-shape__finger hand-shape__finger--curled'
      }
    />
  );
}

/** 엄지 — 손바닥 옆으로 비스듬히 붙습니다. */
function Thumb({
  extended,
  pinch,
}: {
  extended: boolean;
  pinch?: 'index' | 'middle';
}) {
  // 핀치 중이면 엄지가 위쪽 손가락 쪽으로 꺾입니다.
  if (pinch) {
    return (
      <path
        d="M 27 78 Q 16 68 22 54"
        className="hand-shape__thumb-line"
        fill="none"
      />
    );
  }
  if (!extended) {
    // 접은 엄지: 손바닥 옆면에 짧게 붙습니다.
    return (
      <rect
        x={22}
        y={70}
        width={11}
        height={18}
        rx={5.5}
        transform="rotate(-18 27 79)"
        className="hand-shape__finger hand-shape__finger--curled"
      />
    );
  }
  // 편 엄지: 바깥으로 크게 뻗습니다.
  return (
    <rect
      x={6}
      y={56}
      width={11}
      height={34}
      rx={5.5}
      transform="rotate(-42 11 73)"
      className="hand-shape__finger"
    />
  );
}

/** 엄지와 손가락이 맞닿아 생기는 동그라미 (ㅇ, ㅎ, OK, 핑거스냅). */
function PinchRing({ target }: { target: 'index' | 'middle' }) {
  // 중지와 맞대면 동그라미가 조금 더 오른쪽에 생깁니다.
  const cx = target === 'index' ? 30 : 38;
  return (
    <>
      <path
        d={`M ${cx + 3} 62 Q ${cx + 14} 46 ${cx + 2} 38`}
        className="hand-shape__thumb-line"
        fill="none"
      />
      <circle cx={cx + 2} cy={48} r={11} className="hand-shape__ring" fill="none" />
    </>
  );
}

// -----------------------------------------------------------------------------
// 자주 쓰는 손 모양 프리셋
// -----------------------------------------------------------------------------

/** 손가락 상태를 짧게 쓰기 위한 헬퍼. 문자열 'TIMRP' 순서로 지정합니다. */
export function fingers(
  thumb: boolean,
  index: boolean,
  middle: boolean,
  ring: boolean,
  pinky: boolean,
) {
  return { thumb, index, middle, ring, pinky };
}

/** 손이 아예 안 보일 때 쓰는 기본 도형 (다섯 손가락 펴기). */
export const OPEN_HAND: GestureShape = {
  fingers: fingers(true, true, true, true, true),
};
