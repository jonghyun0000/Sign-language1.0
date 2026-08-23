// Shows a horizontal bar that reflects the classifier's current confidence.
// Color shifts from red (low) to green (high) for quick at-a-glance feedback.

interface Props {
  /** 0..1 confidence value. */
  confidence: number;
}

export function ConfidenceIndicator({ confidence }: Props) {
  const pct = Math.round(Math.max(0, Math.min(1, confidence)) * 100);
  // hue: 0 (red) at 0% → 120 (green) at 100%.
  const hue = Math.round(pct * 1.2);
  return (
    <div className="confidence" aria-label={`인식 신뢰도 ${pct}%`}>
      <div className="confidence__label">
        <span>신뢰도</span>
        <span className="confidence__value">{pct}%</span>
      </div>
      <div className="confidence__track">
        <div
          className="confidence__fill"
          style={{
            width: `${pct}%`,
            backgroundColor: `hsl(${hue}, 70%, 50%)`,
          }}
        />
      </div>
    </div>
  );
}
