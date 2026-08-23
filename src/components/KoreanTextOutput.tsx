// =============================================================================
// KoreanTextOutput — 인식된 한글을 보여주는 패널
// =============================================================================
// 자모 조합기가 만든 완성형 한글이 여기에 표시됩니다.
// (예: ㄱ → ㅏ → ㅁ 을 차례로 인식하면 "감"으로 합쳐집니다)

interface Props {
  text: string;
  /** 지금 조합 중인 글자가 있는지 — 있으면 커서를 깜빡입니다. */
  composing: boolean;
}

export function KoreanTextOutput({ text, composing }: Props) {
  return (
    <section className="korean-text-output" aria-label="인식된 한국어 텍스트">
      <header className="korean-text-output__header">
        <h2>인식된 텍스트</h2>
        <span className="korean-text-output__count">{text.length} 자</span>
      </header>

      <div
        className="korean-text-output__body"
        role="textbox"
        aria-readonly="true"
        aria-live="polite"
      >
        {text || (
          <span className="korean-text-output__placeholder">
            손동작을 보여주시면 여기에 한국어가 표시됩니다.
          </span>
        )}
        {/* 조합 중인 글자가 있으면 커서를 보여줘 "입력 중"임을 알립니다. */}
        {composing && <span className="korean-text-output__caret" />}
      </div>
    </section>
  );
}
