// =============================================================================
// icons.tsx — UI 아이콘 모음 (이모지 대체)
// =============================================================================
// 이모지 대신 직접 그린 SVG를 씁니다. 장점:
//   * 기기·폰트와 상관없이 항상 같은 모양
//   * currentColor를 쓰므로 버튼 색상에 자동으로 맞춰짐
//   * 크기를 키워도 흐려지지 않음
//
// 모든 아이콘은 24×24 좌표계에 선(stroke) 기반으로 그렸습니다.

interface IconProps {
  /** 아이콘 크기(px). 기본 18. */
  size?: number;
  className?: string;
}

/** 모든 아이콘이 공유하는 <svg> 껍데기. */
function Svg({
  size = 18,
  className,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`icon ${className ?? ''}`}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** 🔊 → 말하기 (스피커 + 음파) */
export function SpeakerIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M11 5 6 9H2v6h4l5 4V5Z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </Svg>
  );
}

/** 🔇 → 효과음 끔 (스피커 + X) */
export function SpeakerOffIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M11 5 6 9H2v6h4l5 4V5Z" />
      <path d="m16 9 6 6" />
      <path d="m22 9-6 6" />
    </Svg>
  );
}

/** ⏹ → 중지 (정사각형) */
export function StopIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </Svg>
  );
}

/** ♻ → 초기화 (원형 화살표) */
export function ResetIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </Svg>
  );
}

/** ␣ → 띄어쓰기 (스페이스바 기호) */
export function SpaceIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 10v4h16v-4" />
    </Svg>
  );
}

/** ⌫ → 한 글자 지우기 (백스페이스 키) */
export function BackspaceIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M21 5H9l-6 7 6 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1Z" />
      <path d="m17 9-5 6" />
      <path d="m12 9 5 6" />
    </Svg>
  );
}

/** 💾 → 저장 (아래로 향하는 화살표 + 받침) */
export function SaveIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3v11" />
      <path d="m7 10 5 5 5-5" />
      <path d="M4 19h16" />
    </Svg>
  );
}

/** ↩ → 불러오기 (되돌아오는 화살표) */
export function RestoreIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h11a5 5 0 0 1 0 10h-3" />
    </Svg>
  );
}

/** ✕ → 삭제 */
export function CloseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </Svg>
  );
}

/** 🔍 → 검색 (돋보기) */
export function SearchIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Svg>
  );
}

/** 🤟 → 수어 번역 모드 (말풍선 + 손) */
export function TranslateIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H7l-4 3V6Z" />
      <path d="M16 10h3a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1v3l-4-3h-1" />
    </Svg>
  );
}

/** ✨ → 손 이펙트 모드 (반짝임) */
export function SparkleIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3 13.8 9 20 10.8 13.8 12.6 12 19 10.2 12.6 4 10.8 10.2 9 12 3Z" />
      <path d="M18.5 3.5v3" />
      <path d="M17 5h3" />
    </Svg>
  );
}

/** 📖 → 수어 사전 모드 (펼친 책) */
export function BookIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 6.5C10.5 5 8.5 4.5 4 4.5v13c4.5 0 6.5.5 8 2 1.5-1.5 3.5-2 8-2v-13c-4.5 0-6.5.5-8 2Z" />
      <path d="M12 6.5v13" />
    </Svg>
  );
}

/** 손이 안 보일 때 표시 (손바닥 실루엣) */
export function HandIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 11V4.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M12 11V3.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M15 11V5.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-1a7 7 0 0 1-7-7v-1.5a1.5 1.5 0 0 1 3 0V14" />
      <path d="M6 12.5V9a1.5 1.5 0 0 1 3 0v2" />
    </Svg>
  );
}

/** 화면 전체 이펙트 표시용 (테두리가 빛나는 사각형) */
export function FullScreenIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 9V6a2 2 0 0 1 2-2h3" />
      <path d="M15 4h3a2 2 0 0 1 2 2v3" />
      <path d="M20 15v3a2 2 0 0 1-2 2h-3" />
      <path d="M9 20H6a2 2 0 0 1-2-2v-3" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

/** 물음표 — 인식 실패 상태 */
export function QuestionIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6" />
      <path d="M12 17.5v.01" />
    </Svg>
  );
}

/** 🎓 → 수어 배우기 모드 (학사모) */
export function GraduationIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4 2 9l10 5 10-5-10-5Z" />
      <path d="M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5" />
    </Svg>
  );
}

/** ✔ → 완료 표시 */
export function CheckIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m4 12.5 5 5L20 6.5" />
    </Svg>
  );
}

/** → 다음 단계 */
export function ArrowRightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 12h16" />
      <path d="m14 6 6 6-6 6" />
    </Svg>
  );
}

/** ← 이전으로 */
export function ArrowLeftIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 12H4" />
      <path d="m10 6-6 6 6 6" />
    </Svg>
  );
}

/** 🔒 → 아직 잠긴 레슨 */
export function LockIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </Svg>
  );
}
