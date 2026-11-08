import { pipSays } from '../src/features/home/PipCompanion';

const base = {
  hour: 15,
  running: false,
  paused: false,
  leftMs: 0,
  todayMin: 0,
  minutesToNext: 25,
  nextStage: 'Sprout',
  name: 'Asha',
  workoutDone: true,
};

describe('Pip reacts to the day', () => {
  it('cheers each "Not now" the user chose', () => {
    const s = pipSays({ ...base, notNowToday: 3 });
    expect(s.mood).toBe('cheer');
    expect(s.line).toBe('3× "Not now" today. That\'s you, choosing. 🌱');
  });

  it('gets gently concerned past the reel limit, or 50 without one', () => {
    expect(pipSays({ ...base, reelsToday: 20, reelLimit: 20 }).mood).toBe('concerned');
    expect(pipSays({ ...base, reelsToday: 49 }).mood).not.toBe('concerned');
    expect(pipSays({ ...base, reelsToday: 50 }).line).toMatch(/^50 reels today/);
  });

  it('never scolds', () => {
    for (const reels of [0, 20, 80, 300]) {
      const { line } = pipSays({ ...base, reelsToday: reels, notNowToday: 1 });
      expect(line).not.toMatch(/brain ?rot|lazy|bad|shame|waste/i);
    }
  });

  it('focus in progress still comes first', () => {
    expect(
      pipSays({ ...base, running: true, leftMs: 60_000, notNowToday: 5 }).mood,
    ).toBe('calm');
  });
});
