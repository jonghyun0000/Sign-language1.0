// =============================================================================
// hangulComposer — 자모(ㄱ, ㅏ) 스트림을 완성형 한글(가)로 조합
// =============================================================================
// 지화(수어 지문자)는 자음과 모음을 하나씩 표현합니다. 그대로 이어 붙이면
// "ㄱㅏㅁㅅㅏ" 처럼 읽기 힘든 글자가 나오므로, 한글 조합 규칙을 적용해
// "감사" 같은 완성형 글자로 만들어 줍니다.
//
// 한글 유니코드 공식:
//   코드 = 0xAC00 + (초성index × 21 + 중성index) × 28 + 종성index
//
// 이 파일은 "스트리밍 조합기"입니다. 자모가 하나씩 들어올 때마다 현재 만들고
// 있는 글자(pending)를 갱신하고, 더 이상 붙을 수 없으면 확정(flush)합니다.

/** 초성 19자 (조합 공식의 순서 그대로여야 합니다). */
const CHO_LIST = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const;

/** 중성 21자. */
const JUNG_LIST = [
  'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ',
  'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ',
] as const;

/** 종성 28자 (0번은 "받침 없음"). */
const JONG_LIST = [
  '', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ',
  'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const;

const HANGUL_BASE = 0xac00;
const HANGUL_LAST = 0xd7a3;

/** 같은 자음을 두 번 → 쌍자음 (ㄱㄱ → ㄲ). */
const DOUBLE_CONSONANT: Record<string, string> = {
  ㄱ: 'ㄲ',
  ㄷ: 'ㄸ',
  ㅂ: 'ㅃ',
  ㅅ: 'ㅆ',
  ㅈ: 'ㅉ',
};

/** 복합 모음 조합표 (ㅗ + ㅏ → ㅘ). */
const VOWEL_COMBINE: Record<string, Record<string, string>> = {
  ㅗ: { ㅏ: 'ㅘ', ㅐ: 'ㅙ', ㅣ: 'ㅚ' },
  ㅜ: { ㅓ: 'ㅝ', ㅔ: 'ㅞ', ㅣ: 'ㅟ' },
  ㅡ: { ㅣ: 'ㅢ' },
  ㅏ: { ㅣ: 'ㅐ' },
  ㅓ: { ㅣ: 'ㅔ' },
  ㅑ: { ㅣ: 'ㅒ' },
  ㅕ: { ㅣ: 'ㅖ' },
};

/** 겹받침 조합표 (ㄱ + ㅅ → ㄳ). */
const JONG_COMBINE: Record<string, Record<string, string>> = {
  ㄱ: { ㅅ: 'ㄳ' },
  ㄴ: { ㅈ: 'ㄵ', ㅎ: 'ㄶ' },
  ㄹ: { ㄱ: 'ㄺ', ㅁ: 'ㄻ', ㅂ: 'ㄼ', ㅅ: 'ㄽ', ㅌ: 'ㄾ', ㅍ: 'ㄿ', ㅎ: 'ㅀ' },
  ㅂ: { ㅅ: 'ㅄ' },
};

/** 겹받침 → [앞 자음, 뒤 자음] 분해표 (VOWEL 입력 시 뒤 자음이 다음 글자로 넘어감). */
const JONG_SPLIT: Record<string, [string, string]> = {
  ㄳ: ['ㄱ', 'ㅅ'],
  ㄵ: ['ㄴ', 'ㅈ'],
  ㄶ: ['ㄴ', 'ㅎ'],
  ㄺ: ['ㄹ', 'ㄱ'],
  ㄻ: ['ㄹ', 'ㅁ'],
  ㄼ: ['ㄹ', 'ㅂ'],
  ㄽ: ['ㄹ', 'ㅅ'],
  ㄾ: ['ㄹ', 'ㅌ'],
  ㄿ: ['ㄹ', 'ㅍ'],
  ㅀ: ['ㄹ', 'ㅎ'],
  ㅄ: ['ㅂ', 'ㅅ'],
};

/** 복합 모음 → [앞 모음, 뒤 모음] 분해표 (백스페이스용). */
const VOWEL_SPLIT: Record<string, [string, string]> = {
  ㅘ: ['ㅗ', 'ㅏ'],
  ㅙ: ['ㅗ', 'ㅐ'],
  ㅚ: ['ㅗ', 'ㅣ'],
  ㅝ: ['ㅜ', 'ㅓ'],
  ㅞ: ['ㅜ', 'ㅔ'],
  ㅟ: ['ㅜ', 'ㅣ'],
  ㅢ: ['ㅡ', 'ㅣ'],
  ㅐ: ['ㅏ', 'ㅣ'],
  ㅔ: ['ㅓ', 'ㅣ'],
  ㅒ: ['ㅑ', 'ㅣ'],
  ㅖ: ['ㅕ', 'ㅣ'],
};

/** 쌍자음 → 홑자음 분해표 (백스페이스용). */
const DOUBLE_SPLIT: Record<string, string> = {
  ㄲ: 'ㄱ',
  ㄸ: 'ㄷ',
  ㅃ: 'ㅂ',
  ㅆ: 'ㅅ',
  ㅉ: 'ㅈ',
};

/** 입력된 자모가 모음인지 판별. */
export function isVowel(jamo: string): boolean {
  return (JUNG_LIST as readonly string[]).includes(jamo);
}

/** 입력된 자모가 자음인지 판별. */
export function isConsonant(jamo: string): boolean {
  return (
    (CHO_LIST as readonly string[]).includes(jamo) ||
    (JONG_LIST as readonly string[]).includes(jamo)
  );
}

/** 완성형 한글 한 글자인지 판별. */
function isSyllable(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  return code >= HANGUL_BASE && code <= HANGUL_LAST;
}

/** 완성형 한글 → { cho, jung, jong } 문자 분해. */
function decomposeSyllable(
  ch: string,
): { cho: string; jung: string; jong: string } | null {
  if (!isSyllable(ch)) return null;
  const offset = (ch.codePointAt(0) as number) - HANGUL_BASE;
  const jongIdx = offset % 28;
  const jungIdx = Math.floor(offset / 28) % 21;
  const choIdx = Math.floor(offset / (28 * 21));
  return {
    cho: CHO_LIST[choIdx],
    jung: JUNG_LIST[jungIdx],
    jong: JONG_LIST[jongIdx],
  };
}

/** 조합 중인 글자의 상태. 각 칸은 자모 문자 또는 빈 문자열. */
interface PendingSyllable {
  cho: string;
  jung: string;
  jong: string;
}

const EMPTY: PendingSyllable = { cho: '', jung: '', jong: '' };

/** pending 상태를 실제 화면에 보여줄 문자열로 변환. */
function renderPending(p: PendingSyllable): string {
  // 초성 + 중성이 모두 있으면 완성형 글자로 합칩니다.
  if (p.cho && p.jung) {
    const choIdx = CHO_LIST.indexOf(p.cho as (typeof CHO_LIST)[number]);
    const jungIdx = JUNG_LIST.indexOf(p.jung as (typeof JUNG_LIST)[number]);
    const jongIdx = p.jong
      ? JONG_LIST.indexOf(p.jong as (typeof JONG_LIST)[number])
      : 0;
    // 표에 없는 조합(예: 종성으로 쓸 수 없는 자음)은 안전하게 나열만 합니다.
    if (choIdx >= 0 && jungIdx >= 0 && jongIdx >= 0) {
      return String.fromCharCode(
        HANGUL_BASE + (choIdx * 21 + jungIdx) * 28 + jongIdx,
      );
    }
  }
  // 아직 합칠 수 없으면 있는 자모를 그대로 이어 붙입니다.
  return `${p.cho}${p.jung}${p.jong}`;
}

/**
 * 스트리밍 한글 조합기.
 *
 * ```ts
 * const c = new HangulComposer();
 * c.push('ㄱ'); c.push('ㅏ'); c.push('ㅁ');  // → "감"
 * c.push('ㅅ'); c.push('ㅏ');                // → "감사"
 * c.text // "감사"
 * ```
 */
export class HangulComposer {
  /** 이미 확정된 글자들. */
  private committed = '';
  /** 지금 조합 중인 글자. */
  private pending: PendingSyllable = { ...EMPTY };

  /** 화면에 보여줄 전체 텍스트(확정 + 조합 중). */
  get text(): string {
    return this.committed + renderPending(this.pending);
  }

  /** 조합 중인 글자가 있는지. */
  get hasPending(): boolean {
    return Boolean(this.pending.cho || this.pending.jung || this.pending.jong);
  }

  /**
   * 다음에 어떤 자모가 오는 게 자연스러운지 알려줍니다.
   * "스마트 사전 모드"가 이 값을 보고 자음/모음 후보를 자동으로 좁힙니다.
   */
  get expecting(): 'consonant' | 'vowel' {
    // 초성만 있고 중성이 없으면 다음은 모음이어야 글자가 완성됩니다.
    if (this.pending.cho && !this.pending.jung) return 'vowel';
    // 그 외(빈 상태, 또는 이미 글자가 완성된 상태)에는 자음이 자연스럽습니다.
    return 'consonant';
  }

  /** 자모 하나를 입력합니다. */
  push(jamo: string): void {
    if (isVowel(jamo)) this.pushVowel(jamo);
    else if (isConsonant(jamo)) this.pushConsonant(jamo);
    else this.pushRaw(jamo); // 자모가 아닌 문자는 그대로 붙입니다.
  }

  /** 단어/문장을 통째로 입력합니다 (조합 중인 글자는 먼저 확정). */
  pushWord(word: string): void {
    this.flush();
    this.committed += word;
  }

  /** 자모가 아닌 임의 문자열을 그대로 붙입니다. */
  private pushRaw(text: string): void {
    this.flush();
    this.committed += text;
  }

  // ---------------------------------------------------------------------------
  // 자음 입력 규칙
  // ---------------------------------------------------------------------------
  private pushConsonant(c: string): void {
    const p = this.pending;

    // 1) 빈 상태 → 초성으로 시작.
    if (!p.cho && !p.jung && !p.jong) {
      p.cho = c;
      return;
    }

    // 2) 초성만 있는 상태 → 같은 자음이면 쌍자음으로 합칩니다 (ㄱㄱ → ㄲ).
    if (p.cho && !p.jung) {
      if (p.cho === c && DOUBLE_CONSONANT[c]) {
        p.cho = DOUBLE_CONSONANT[c];
        return;
      }
      // 합칠 수 없으면 지금 자음을 확정하고 새 글자를 시작합니다.
      this.flush();
      this.pending.cho = c;
      return;
    }

    // 3) 모음만 있는 상태(홀로 쓰인 모음) → 확정하고 새 글자 시작.
    if (!p.cho && p.jung) {
      this.flush();
      this.pending.cho = c;
      return;
    }

    // 4) 초성 + 중성이 있고 받침이 비어 있으면 → 받침으로 넣어봅니다.
    if (p.cho && p.jung && !p.jong) {
      if ((JONG_LIST as readonly string[]).includes(c)) {
        p.jong = c;
        return;
      }
      // 받침으로 쓸 수 없는 자음(ㄸ, ㅃ, ㅉ)이면 새 글자로.
      this.flush();
      this.pending.cho = c;
      return;
    }

    // 5) 받침까지 있으면 → 겹받침으로 합칠 수 있는지 확인.
    if (p.cho && p.jung && p.jong) {
      const combined = JONG_COMBINE[p.jong]?.[c];
      if (combined) {
        p.jong = combined;
        return;
      }
      this.flush();
      this.pending.cho = c;
    }
  }

  // ---------------------------------------------------------------------------
  // 모음 입력 규칙
  // ---------------------------------------------------------------------------
  private pushVowel(v: string): void {
    const p = this.pending;

    // 1) 빈 상태 → 홀로 쓰인 모음.
    if (!p.cho && !p.jung && !p.jong) {
      p.jung = v;
      return;
    }

    // 2) 초성만 있는 상태 → 중성을 채워 글자를 만듭니다 (ㄱ + ㅏ = 가).
    if (p.cho && !p.jung) {
      p.jung = v;
      return;
    }

    // 3) 중성이 있고 받침이 없는 상태 → 복합 모음으로 합칠 수 있는지 확인.
    if (p.jung && !p.jong) {
      const combined = VOWEL_COMBINE[p.jung]?.[v];
      if (combined) {
        p.jung = combined;
        return;
      }
      // 합칠 수 없으면 확정하고 홀로 쓰인 모음으로 시작.
      this.flush();
      this.pending.jung = v;
      return;
    }

    // 4) 받침이 있는 상태 → 받침이 다음 글자의 초성으로 넘어갑니다.
    //    예) 각 + ㅏ → "가" + "가"
    if (p.cho && p.jung && p.jong) {
      const split = JONG_SPLIT[p.jong];
      // 겹받침이면 앞 자음만 남기고 뒤 자음이 넘어갑니다 (갃 + ㅏ → 각 + 사).
      const movingCho = split ? split[1] : p.jong;
      p.jong = split ? split[0] : '';
      this.flush();
      this.pending.cho = movingCho;
      this.pending.jung = v;
    }
  }

  // ---------------------------------------------------------------------------
  // 편집 동작
  // ---------------------------------------------------------------------------

  /** 조합 중인 글자를 확정하고 pending을 비웁니다. */
  flush(): void {
    if (this.hasPending) {
      this.committed += renderPending(this.pending);
      this.pending = { ...EMPTY };
    }
  }

  /** 띄어쓰기. */
  space(): void {
    this.flush();
    this.committed += ' ';
  }

  /**
   * 한 단계 지우기.
   * 조합 중인 글자가 있으면 그 안의 마지막 자모만 지우고,
   * 없으면 확정된 마지막 글자를 다시 분해해서 마지막 자모를 지웁니다.
   */
  backspace(): void {
    const p = this.pending;

    // 1) 조합 중인 글자 안에서 지우기.
    if (p.jong) {
      const split = JONG_SPLIT[p.jong];
      p.jong = split ? split[0] : '';
      return;
    }
    if (p.jung) {
      const split = VOWEL_SPLIT[p.jung];
      p.jung = split ? split[0] : '';
      return;
    }
    if (p.cho) {
      const single = DOUBLE_SPLIT[p.cho];
      p.cho = single ?? '';
      return;
    }

    // 2) 조합 중인 게 없으면 확정된 마지막 글자를 되살려서 지웁니다.
    if (!this.committed) return;
    const lastChar = Array.from(this.committed).pop() as string;
    this.committed = this.committed.slice(0, -lastChar.length);

    const decomposed = decomposeSyllable(lastChar);
    if (decomposed) {
      // 완성형 글자였으면 분해해서 pending으로 되돌린 뒤 한 번 더 지웁니다.
      this.pending = {
        cho: decomposed.cho,
        jung: decomposed.jung,
        jong: decomposed.jong,
      };
      this.backspace();
    }
    // 완성형이 아니었으면(공백, 단어 등) 그냥 지운 상태로 끝냅니다.
  }

  /** 전체 초기화. */
  reset(): void {
    this.committed = '';
    this.pending = { ...EMPTY };
  }

  /** 외부에서 텍스트를 통째로 교체할 때 사용(기록 불러오기 등). */
  setText(text: string): void {
    this.committed = text;
    this.pending = { ...EMPTY };
  }
}
