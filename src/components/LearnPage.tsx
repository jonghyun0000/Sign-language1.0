// =============================================================================
// LearnPage — 수어 배우기 모드
// =============================================================================
// 수어를 전혀 모르는 사람이 첫 화면에서 막히지 않도록 만든 흐름입니다.
//
// 사전(GuidePage)과의 차이:
//   사전  = 37장의 카드가 한꺼번에. 이미 아는 사람이 찾아보는 용도.
//   배우기 = 한 번에 하나씩. 쉬운 것부터. 카메라가 실시간으로 교정.
//
// 화면 구성:
//   레슨 목록 → 레슨 선택 → (설명 읽기) → 글자 하나씩 연습 → 완료
//
// 연습 화면에서 가장 중요한 것은 **구체적인 교정 안내**입니다.
// "틀렸습니다"가 아니라 "새끼손가락을 접으세요"라고 말해줘야 합니다.
// 그 판단은 CoachService 가 합니다.

import { useEffect, useMemo, useState } from 'react';

import { LESSONS, lessonConfidenceNote, type Lesson } from '../data/lessons';
import { getRuleByLabel } from '../data/koreanGestures';
import { CONFIDENCE_LABEL, type Confidence } from '../data/handshapes';
import type { CoachFeedback } from '../services/CoachService';
import { HandShape } from './HandShape';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  LockIcon,
  ResetIcon,
} from './icons';

interface Props {
  /** 코치가 매 프레임 계산한 결과. */
  feedback: CoachFeedback;
  /** 지금 연습할 글자를 코치에게 알려줍니다. */
  onTargetChange: (label: string | null) => void;
  /** 코치의 진행 상태만 되돌립니다. */
  onResetCoach: () => void;
  /** 글자 하나 통과. */
  onTargetMastered: (label: string) => void;
  /** 레슨 완료. */
  onLessonComplete: (id: string) => void;
  isLessonDone: (id: string) => boolean;
  isTargetDone: (label: string) => boolean;
  onResetProgress: () => void;
  /** 카메라와 모델이 준비되었는지. 안 되어 있으면 연습을 할 수 없습니다. */
  cameraReady: boolean;
}

export function LearnPage(props: Props) {
  const [openLessonId, setOpenLessonId] = useState<string | null>(null);

  const lesson = openLessonId
    ? (LESSONS.find((l) => l.id === openLessonId) ?? null)
    : null;

  // 레슨을 닫으면 코치도 연습을 멈춥니다.
  useEffect(() => {
    if (!lesson) props.onTargetChange(null);
    // props 는 매 렌더 새로 만들어지므로 의존성에서 뺍니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson]);

  if (lesson) {
    return (
      <LessonRunner
        {...props}
        lesson={lesson}
        onExit={() => setOpenLessonId(null)}
      />
    );
  }

  return (
    <LessonList
      onOpen={setOpenLessonId}
      isLessonDone={props.isLessonDone}
      isTargetDone={props.isTargetDone}
      onResetProgress={props.onResetProgress}
    />
  );
}

// =============================================================================
// 레슨 목록
// =============================================================================

function LessonList({
  onOpen,
  isLessonDone,
  isTargetDone,
  onResetProgress,
}: {
  onOpen: (id: string) => void;
  isLessonDone: (id: string) => boolean;
  isTargetDone: (label: string) => boolean;
  onResetProgress: () => void;
}) {
  const doneCount = LESSONS.filter((l) => isLessonDone(l.id)).length;
  const percent = Math.round((doneCount / LESSONS.length) * 100);

  return (
    <section className="learn" aria-label="수어 배우기">
      <header className="learn__header">
        <div>
          <h2 className="learn__title">수어 배우기</h2>
          <p className="learn__subtitle">
            수어를 처음 접해도 괜찮습니다. 위에서부터 순서대로 따라오시면 됩니다.
            카메라가 손 모양을 보고 무엇을 고쳐야 하는지 알려줍니다.
          </p>
        </div>
      </header>

      <div className="learn__progress">
        <div className="learn__progress-head">
          <span>
            전체 진도 <strong>{doneCount}</strong> / {LESSONS.length} 과
          </span>
          <span>{percent}%</span>
        </div>
        <div className="learn__progress-track">
          <div className="learn__progress-fill" style={{ width: `${percent}%` }} />
        </div>
        {doneCount > 0 && (
          <button
            type="button"
            className="learn__reset"
            onClick={onResetProgress}
          >
            진도 초기화
          </button>
        )}
      </div>

      <ol className="learn__lessons">
        {LESSONS.map((lesson, index) => {
          const done = isLessonDone(lesson.id);
          // 앞 레슨을 마쳐야 다음이 열립니다. 첫 레슨은 항상 열려 있습니다.
          const unlocked = index === 0 || isLessonDone(LESSONS[index - 1].id);
          const masteredInLesson = lesson.targets.filter(isTargetDone).length;

          return (
            <li key={lesson.id}>
              <button
                type="button"
                className={`lesson-item ${done ? 'lesson-item--done' : ''} ${
                  unlocked ? '' : 'lesson-item--locked'
                }`}
                onClick={() => unlocked && onOpen(lesson.id)}
                disabled={!unlocked}
              >
                <span className="lesson-item__no">
                  {done ? <CheckIcon size={16} /> : unlocked ? index + 1 : <LockIcon size={15} />}
                </span>

                <span className="lesson-item__text">
                  <strong>{lesson.title}</strong>
                  <span className="lesson-item__sub">{lesson.subtitle}</span>
                </span>

                {lesson.targets.length > 0 && (
                  <span className="lesson-item__shapes">
                    {lesson.targets.slice(0, 4).map((label) => {
                      const rule = getRuleByLabel(label);
                      return rule ? (
                        <HandShape
                          key={label}
                          shape={rule.shape}
                          size={30}
                          active={isTargetDone(label)}
                        />
                      ) : null;
                    })}
                    {lesson.targets.length > 4 && (
                      <span className="lesson-item__more">
                        +{lesson.targets.length - 4}
                      </span>
                    )}
                  </span>
                )}

                {lesson.targets.length > 0 && (
                  <span className="lesson-item__count">
                    {masteredInLesson}/{lesson.targets.length}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>

      <footer className="learn__note">
        <strong>먼저 알아두세요.</strong> 이 앱의 손 모양 중 자료로 확인된 것은
        ㅎ 하나뿐이고 나머지는 추정입니다. 여기서 익힌 손 모양이 실제 지문자와
        다를 수 있습니다. 정확한 학습은 한국농아인협회나 국립국어원 한국수어사전을
        이용해 주세요.
      </footer>
    </section>
  );
}

// =============================================================================
// 레슨 진행
// =============================================================================

function LessonRunner({
  lesson,
  feedback,
  cameraReady,
  onTargetChange,
  onResetCoach,
  onTargetMastered,
  onLessonComplete,
  onExit,
}: Props & { lesson: Lesson; onExit: () => void }) {
  // 설명이 있는 레슨은 설명부터 보여줍니다.
  const [showIntro, setShowIntro] = useState(Boolean(lesson.intro));
  /** 지금 몇 번째 글자를 연습 중인지. */
  const [stepIndex, setStepIndex] = useState(0);
  /** 이 레슨에서 통과한 글자들. */
  const [cleared, setCleared] = useState<string[]>([]);

  const isReadingOnly = lesson.targets.length === 0;
  const currentLabel = lesson.targets[stepIndex] ?? null;
  const rule = currentLabel ? getRuleByLabel(currentLabel) : null;

  // 이 레슨의 손 모양들이 얼마나 믿을 만한지 한 줄 요약.
  const confidenceNote = useMemo(() => {
    const list = lesson.targets
      .map((l) => getRuleByLabel(l)?.confidence)
      .filter((c): c is Confidence => Boolean(c));
    return list.length ? lessonConfidenceNote(list) : null;
  }, [lesson.targets]);

  // 현재 단계를 코치에게 알려줍니다.
  useEffect(() => {
    onTargetChange(showIntro || isReadingOnly ? null : currentLabel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLabel, showIntro, isReadingOnly]);

  // 통과하면 기록하고 잠시 뒤 다음 단계로 넘어갑니다.
  useEffect(() => {
    if (!feedback.passed || !currentLabel) return;
    if (cleared.includes(currentLabel)) return;

    setCleared((prev) => [...prev, currentLabel]);
    onTargetMastered(currentLabel);

    // 성공 화면을 잠깐 보여준 뒤 넘어갑니다.
    const timer = window.setTimeout(() => {
      if (stepIndex + 1 < lesson.targets.length) {
        setStepIndex((i) => i + 1);
        onResetCoach();
      }
    }, 1200);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback.passed, currentLabel]);

  const allCleared =
    !isReadingOnly && cleared.length >= lesson.targets.length;

  // --- 설명 화면 ---
  if (showIntro && lesson.intro) {
    return (
      <section className="learn learn--lesson" aria-label={lesson.title}>
        <LessonHeader lesson={lesson} onExit={onExit} />

        <article className="lesson-intro">
          <h3>{lesson.intro.heading}</h3>
          {lesson.intro.body.map((paragraph) => (
            <p key={paragraph.slice(0, 24)}>{paragraph}</p>
          ))}
        </article>

        <div className="lesson-actions">
          {isReadingOnly ? (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                onLessonComplete(lesson.id);
                onExit();
              }}
            >
              <CheckIcon />
              읽었습니다
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setShowIntro(false)}
            >
              연습 시작
              <ArrowRightIcon />
            </button>
          )}
        </div>
      </section>
    );
  }

  // --- 레슨 완료 화면 ---
  if (allCleared) {
    return (
      <section className="learn learn--lesson" aria-label={lesson.title}>
        <LessonHeader lesson={lesson} onExit={onExit} />

        <div className="lesson-complete">
          <div className="lesson-complete__mark">
            <CheckIcon size={40} />
          </div>
          <h3>{lesson.title} 완료</h3>
          <p>{lesson.targets.join(' · ')} 를 익히셨습니다.</p>

          {lesson.goal && (
            <p className="lesson-complete__goal">
              이제 <strong>{lesson.goal}</strong> 를 손으로 쓸 수 있습니다.
            </p>
          )}

          <div className="lesson-actions">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => {
                setCleared([]);
                setStepIndex(0);
                onResetCoach();
              }}
            >
              <ResetIcon />
              다시 연습
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                onLessonComplete(lesson.id);
                onExit();
              }}
            >
              레슨 목록으로
              <ArrowRightIcon />
            </button>
          </div>
        </div>
      </section>
    );
  }

  // --- 연습 화면 ---
  return (
    <section className="learn learn--lesson" aria-label={lesson.title}>
      <LessonHeader lesson={lesson} onExit={onExit} />

      {/* 단계 표시 */}
      <div className="lesson-steps" aria-label="진행 상황">
        {lesson.targets.map((label, i) => (
          <span
            key={label + i}
            className={`lesson-steps__dot ${
              cleared.includes(label)
                ? 'lesson-steps__dot--done'
                : i === stepIndex
                  ? 'lesson-steps__dot--current'
                  : ''
            }`}
          >
            {label}
          </span>
        ))}
      </div>

      {rule && (
        <div className="practice">
          {/* 왼쪽: 만들어야 할 손 모양 */}
          <div className="practice__target">
            <div className="practice__label">{rule.label}</div>
            <HandShape
              shape={rule.shape}
              size={150}
              active={feedback.passed}
            />
            <p className="practice__how">{rule.hint}</p>
            <span className={`practice__confidence practice__confidence--${rule.confidence}`}>
              {CONFIDENCE_LABEL[rule.confidence]}
              {rule.handshapeName ? ` · ${rule.handshapeName}` : ''}
            </span>
          </div>

          {/* 오른쪽: 실시간 교정 */}
          <div className="practice__coach">
            {/* 카메라가 없으면 연습 자체가 불가능합니다. 코치 안내 대신
                무엇을 해야 하는지 먼저 알려줘야 초보자가 막히지 않습니다. */}
            {!cameraReady ? (
              <div className="coach-hint coach-hint--blocked">
                카메라를 켜야 연습할 수 있습니다
                <span className="coach-hint__sub">
                  위쪽 안내를 따라 카메라를 허용한 뒤 "다시 시도"를 눌러주세요.
                  그동안 왼쪽 그림을 보며 손 모양을 따라 해보셔도 좋습니다.
                </span>
              </div>
            ) : (
              <div className={`coach-hint coach-hint--${feedback.tone}`}>
                {feedback.hint}
              </div>
            )}

            {/* 자세 유지 게이지 */}
            <div className="coach-hold" aria-label="자세 유지">
              <div
                className="coach-hold__fill"
                style={{ width: `${Math.round(feedback.holdProgress * 100)}%` }}
              />
            </div>

            {/* 손가락별 상태 */}
            <ul className="coach-fingers">
              {(
                [
                  ['thumb', '엄지'],
                  ['index', '검지'],
                  ['middle', '중지'],
                  ['ring', '약지'],
                  ['pinky', '새끼'],
                ] as const
              ).map(([key, name]) => (
                <li
                  key={key}
                  className={`coach-fingers__item coach-fingers__item--${feedback.fingers[key]}`}
                >
                  <span className="coach-fingers__name">{name}</span>
                  <span className="coach-fingers__state">
                    {feedback.fingers[key] === 'unknown'
                      ? '—'
                      : feedback.fingers[key] === 'ok'
                        ? '좋아요'
                        : feedback.fingers[key] === 'should-extend'
                          ? '펴기'
                          : '접기'}
                  </span>
                </li>
              ))}
            </ul>

            {feedback.direction !== 'none' && (
              <div
                className={`coach-direction coach-direction--${feedback.direction}`}
              >
                방향 {feedback.direction === 'ok' ? '맞음' : '다시'}
              </div>
            )}

            {lesson.tip && <p className="practice__tip">{lesson.tip}</p>}
            {confidenceNote && (
              <p className="practice__warning">{confidenceNote}</p>
            )}
          </div>
        </div>
      )}

      <div className="lesson-actions">
        <button
          type="button"
          className="btn btn--secondary"
          onClick={() => {
            setStepIndex((i) => Math.max(0, i - 1));
            onResetCoach();
          }}
          disabled={stepIndex === 0}
        >
          <ArrowLeftIcon />
          이전
        </button>
        <button
          type="button"
          className="btn btn--secondary"
          onClick={() => {
            // 잘 안 되면 건너뛸 수 있어야 합니다. 막히면 그만두게 되니까요.
            if (stepIndex + 1 < lesson.targets.length) {
              setStepIndex((i) => i + 1);
              onResetCoach();
            }
          }}
          disabled={stepIndex + 1 >= lesson.targets.length}
        >
          건너뛰기
          <ArrowRightIcon />
        </button>
      </div>
    </section>
  );
}

/** 레슨 화면 상단 (뒤로 가기 + 제목). */
function LessonHeader({ lesson, onExit }: { lesson: Lesson; onExit: () => void }) {
  return (
    <header className="lesson-header">
      <button type="button" className="lesson-header__back" onClick={onExit}>
        <ArrowLeftIcon size={16} />
        레슨 목록
      </button>
      <div>
        <h2 className="learn__title">{lesson.title}</h2>
        <p className="learn__subtitle">{lesson.subtitle}</p>
      </div>
    </header>
  );
}
