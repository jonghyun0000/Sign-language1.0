// 최상위 모드 전환 — 수어 번역 / 손 이펙트 / 수어 사전
//
// 이모지 대신 SVG 아이콘을 씁니다. 기기마다 모양이 달라지지 않고,
// 버튼 색상에 맞춰 자동으로 색이 바뀝니다.

import type { AppMode } from '../types';
import { BookIcon, SparkleIcon, TranslateIcon } from './icons';

interface Props {
  mode: AppMode;
  onChange: (mode: AppMode) => void;
}

const MODES: Array<{
  id: AppMode;
  label: string;
  desc: string;
  Icon: typeof TranslateIcon;
}> = [
  {
    id: 'translate',
    label: '수어 번역',
    desc: '손동작을 한글로 바꾸고 읽어줍니다',
    Icon: TranslateIcon,
  },
  {
    id: 'effect',
    label: '손 이펙트',
    desc: '손 모양으로 거미줄·화염·번개를 발사합니다',
    Icon: SparkleIcon,
  },
  {
    id: 'guide',
    label: '수어 사전',
    desc: '어떤 손 모양이 어떤 뜻인지 알려줍니다',
    Icon: BookIcon,
  },
];

export function ModeSelector({ mode, onChange }: Props) {
  return (
    <div className="mode-selector" role="tablist" aria-label="모드 선택">
      {MODES.map(({ id, label, desc, Icon }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={mode === id}
          className={`mode-selector__btn ${
            mode === id ? 'mode-selector__btn--active' : ''
          }`}
          onClick={() => onChange(id)}
          title={desc}
        >
          <Icon size={18} />
          <span className="mode-selector__label">{label}</span>
        </button>
      ))}
    </div>
  );
}
