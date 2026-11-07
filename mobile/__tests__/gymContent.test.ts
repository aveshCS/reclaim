import { FACES, NAMES } from '../src/features/gym/content/people';
import { PASSAGES } from '../src/features/gym/content/passages';
import { REASONING, SKILL_LABELS } from '../src/features/gym/content/reasoning';

describe('content review checks', () => {
  it('has at least 30 reasoning exercises with unique ids', () => {
    expect(REASONING.length).toBeGreaterThanOrEqual(30);
    const ids = REASONING.map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers every skill with at least 5 items and a range of difficulty', () => {
    for (const skill of Object.keys(SKILL_LABELS)) {
      const items = REASONING.filter(r => r.skill === skill);
      expect(items.length).toBeGreaterThanOrEqual(5);
    }
    const levels = new Set(REASONING.map(r => r.difficulty));
    expect([...levels].sort()).toEqual([1, 2, 3]);
  });

  it.each(REASONING.map(r => [r.id, r]))(
    '%s is well formed (answer key, explanation, distinct options)',
    (_, r) => {
      const item = r as (typeof REASONING)[number];
      expect(item.options.length).toBe(4);
      expect(new Set(item.options).size).toBe(4);
      expect(item.answer).toBeGreaterThanOrEqual(0);
      expect(item.answer).toBeLessThan(item.options.length);
      expect(item.passage.trim().length).toBeGreaterThan(20);
      expect(item.question.trim().length).toBeGreaterThan(5);
      expect(item.explanation.trim().length).toBeGreaterThan(40);
      // No clinical or IQ language in teaching content.
      const all = `${item.passage} ${item.explanation}`.toLowerCase();
      expect(all).not.toMatch(/\biq\b|adhd|diagnos|disorder/);
    },
  );

  it('has valid reading passages', () => {
    expect(PASSAGES.length).toBeGreaterThanOrEqual(6);
    expect(new Set(PASSAGES.map(p => p.id)).size).toBe(PASSAGES.length);
    for (const p of PASSAGES) {
      expect(p.text.split(/\s+/).length).toBeGreaterThan(60);
      expect(p.questions).toHaveLength(3);
      for (const q of p.questions) {
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(q.answer).toBeLessThan(q.options.length);
        expect(new Set(q.options).size).toBe(q.options.length);
      }
      // Correct answers are distinct within a passage.
      const answers = p.questions.map(q => q.options[q.answer]);
      expect(new Set(answers).size).toBe(answers.length);
    }
  });

  it('has enough distinct faces and names for the hardest level', () => {
    expect(new Set(FACES).size).toBe(FACES.length);
    expect(new Set(NAMES).size).toBe(NAMES.length);
    expect(FACES.length).toBeGreaterThanOrEqual(6);
    expect(NAMES.length).toBeGreaterThanOrEqual(10);
  });
});
