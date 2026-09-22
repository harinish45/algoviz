/**
 * Practice panel.
 *
 * Questions come from `buildPracticeQuestions` — the same trace and state model
 * the visualiser uses, so a "correct answer" here is grounded in recorded
 * execution facts. Grading is deterministic (`gradeAnswer`) and every attempt
 * is reported upward through `onResult` so mastery scores stay honest.
 */
import { useMemo, useState } from 'react';
import { PRACTICE_KIND_LABELS, buildPracticeQuestions, gradeAnswer } from '../../core/practice';
import type { AnyAlgorithmDefinition, ExecutionTrace, PracticeGrade } from '../../core/types';

interface AnswerState {
  text: string;
  selected?: number;
  grade?: PracticeGrade;
}

interface PracticePanelProps {
  definition: AnyAlgorithmDefinition;
  trace: ExecutionTrace<unknown, unknown>;
  /** Reports each graded attempt to the mastery engine. */
  onResult: (correct: boolean) => void;
}

export function PracticePanel({
  definition,
  trace,
  onResult
}: PracticePanelProps): React.JSX.Element {
  const questions = useMemo(() => buildPracticeQuestions(definition, trace), [definition, trace]);

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [score, setScore] = useState({ attempted: 0, correct: 0 });

  // Answers are keyed by (trace signature, question index): a regenerated
  // question set can never inherit the previous trace's answers, and no reset
  // effect (cascading render) is required.
  const answerKey = `${trace.meta.eventCount}:${JSON.stringify(trace.input)}#${index}`;
  const answer = answers[answerKey] ?? { text: '' };
  const grade = answer.grade;
  const selected = answer.selected;
  const text = answer.text;
  const setAnswer = (patch: Partial<AnswerState>): void => {
    setAnswers((current) => {
      const previous = current[answerKey] ?? { text: '' };
      return { ...current, [answerKey]: { ...previous, ...patch } };
    });
  };

  if (questions.length === 0) {
    return (
      <section className="card" aria-label="Practice">
        <div className="card-head">
          <span className="card-title">Practice</span>
        </div>
        <p className="muted">
          The current trace does not hold enough evidence to ground a question. Run a richer input
          (more steps) and the generator will produce one.
        </p>
      </section>
    );
  }

  // Guard against a stale index during the render that first sees new questions.
  const question = questions[Math.min(index, questions.length - 1)];
  const choices = question.choices ?? [];
  const multipleChoice = choices.length > 0;
  const answered = Boolean(grade);
  const ready = !answered && (multipleChoice ? selected !== undefined : text.trim().length > 0);

  const submit = (): void => {
    if (answered || !ready) return;
    const result = gradeAnswer(question, multipleChoice ? { choiceIndex: selected } : { text });
    setAnswer({ text, selected, grade: result });
    setScore((current) => ({
      attempted: current.attempted + 1,
      correct: current.correct + (result.correct ? 1 : 0)
    }));
    onResult(result.correct);
  };

  const next = (): void => {
    setIndex((current) => Math.min(current + 1, questions.length - 1));
  };

  const atLast = index >= questions.length - 1;
  return (
    <section className="card" aria-label="Practice">
      <div className="card-head">
        <span className="card-title">Practice</span>
        <span className="card-hint">
          question {index + 1} / {questions.length} · score {score.correct}/{score.attempted}{' '}
          attempted
        </span>
      </div>

      <div className="row">
        <span className="q-kind">{PRACTICE_KIND_LABELS[question.kind]}</span>
        <span className={`badge ${question.difficulty}`}>{question.difficulty}</span>
        {question.eventSteps.length > 0 ? (
          <span className="badge">
            grounded in {question.eventSteps.length > 1 ? 'steps' : 'step'}{' '}
            {question.eventSteps.join(', ')}
          </span>
        ) : null}
      </div>

      <p>
        <strong>{question.prompt}</strong>
      </p>

      {multipleChoice ? (
        <div className="stack" role="radiogroup" aria-label="Answer choices">
          {choices.map((choice, choiceIndex) => {
            let className = 'choice';
            if (grade && choiceIndex === question.answerIndex) className = 'choice ok';
            else if (grade && choiceIndex === selected) className = 'choice bad';
            return (
              <label className={className} key={`${question.id}-${choiceIndex}`}>
                <input
                  type="radio"
                  name={question.id}
                  checked={selected === choiceIndex}
                  disabled={answered}
                  onChange={() => setAnswer({ selected: choiceIndex })}
                />
                <span>{choice}</span>
              </label>
            );
          })}
        </div>
      ) : (
        <div className="field">
          <label htmlFor="practice-answer">Your answer</label>
          <textarea
            id="practice-answer"
            rows={2}
            value={text}
            disabled={answered}
            spellCheck={false}
            placeholder="the exact value, a bound, or a short phrase"
            onChange={(event) => setAnswer({ text: event.target.value })}
          />
        </div>
      )}

      {grade ? (
        <div className="stack" style={{ marginTop: '0.7rem' }}>
          <div className="row">
            <span className={`badge ${grade.correct ? 'easy' : 'hard'}`}>
              {grade.correct ? 'correct' : 'not quite'}
            </span>
            <span className="mono card-hint">
              expected: {grade.expected} · received: {grade.received}
            </span>
          </div>
          <p>{grade.explanation}</p>
          <div className="btn-row">
            {atLast ? (
              <span className="card-hint">That was the last question for this trace.</span>
            ) : (
              <button type="button" className="primary" onClick={next}>
                Next question ▶
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="btn-row" style={{ marginTop: '0.7rem' }}>
          <button type="button" className="primary" onClick={submit} disabled={!ready}>
            Check answer
          </button>
          <span className="card-hint">
            {multipleChoice
              ? 'Select the single best option.'
              : 'Type the exact value or a short phrase.'}
          </span>
        </div>
      )}

      <p className="card-hint">
        Questions are generated deterministically from this trace — the same input always produces
        the same questions, answers and explanations.
      </p>
    </section>
  );
}