/**
 * GestureGuide 컴포넌트
 * Gesture Guide Component
 *
 * 인식 가능한 자음과 단어의 손 모양 설명을 보여주는 가이드 패널입니다.
 * Guide panel showing hand shape descriptions for recognizable consonants and words.
 */

import { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { CONSONANT_PATTERNS, WORD_PATTERNS } from '../data/gesturePatterns';

export function GestureGuide() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`gesture-guide ${isOpen ? 'gesture-guide--open' : ''}`}>
      <button
        type="button"
        className="gesture-guide-toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <BookOpen size={18} strokeWidth={1.5} />
        <span>제스처 가이드</span>
        {isOpen ? (
          <ChevronUp size={18} strokeWidth={1.5} />
        ) : (
          <ChevronDown size={18} strokeWidth={1.5} />
        )}
      </button>

      {isOpen && (
        <div className="gesture-guide-content">
          <div className="gesture-guide-section">
            <h4>자음 (한 손)</h4>
            <ul>
              {CONSONANT_PATTERNS.map((p) => (
                <li key={p.character}>
                  <strong>{p.character}</strong>
                  <span>{p.description}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="gesture-guide-section">
            <h4>단어 (양 손)</h4>
            <ul>
              {WORD_PATTERNS.map((p) => (
                <li key={p.word}>
                  <strong>{p.word}</strong>
                  <span>{p.description}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="gesture-guide-note">
            이 패턴은 학습용 단순화 모델이며 실제 한국 수어와 다를 수 있습니다.
            제스처를 약 0.8초간 안정적으로 유지하면 텍스트에 추가됩니다.
          </p>
        </div>
      )}
    </div>
  );
}
