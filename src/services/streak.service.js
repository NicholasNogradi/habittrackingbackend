import { Checkin } from '../models/index.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function toDate(str) {
  // DATEONLY stored as "YYYY-MM-DD"
  const [y, m, d] = str.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function diffDays(a, b) {
  return Math.round((a - b) / DAY_MS);
}

/**
 * Compute current and longest streaks for a habit from its completed check-ins.
 * A streak is consecutive calendar days with a "completed" check-in.
 * (For weekly/custom habits this is a reasonable daily-consecutive approximation.)
 */
export async function computeStreaks(habitId) {
  const checkins = await Checkin.findAll({
    where: { habitId, status: 'completed' },
    order: [['date', 'ASC']],
    attributes: ['date'],
  });

  if (checkins.length === 0) {
    return { currentStreak: 0, longestStreak: 0, streaks: [] };
  }

  const days = checkins.map((c) => toDate(c.date));
  const unique = [...new Set(days)].sort((a, b) => a - b);

  const streaks = [];
  let runStart = unique[0];
  let prev = unique[0];

  for (let i = 1; i < unique.length; i++) {
    if (diffDays(unique[i], prev) === 1) {
      prev = unique[i];
    } else {
      streaks.push({ start: runStart, end: prev });
      runStart = unique[i];
      prev = unique[i];
    }
  }
  streaks.push({ start: runStart, end: prev });

  const longestStreak = streaks.reduce(
    (max, s) => Math.max(max, diffDays(s.end, s.start) + 1),
    0
  );

  // Current streak is active only if the last completed day is today or yesterday.
  const today = toDate(new Date().toISOString().slice(0, 10));
  const last = streaks[streaks.length - 1];
  const gap = diffDays(today, last.end);
  const lastLen = diffDays(last.end, last.start) + 1;
  const currentStreak = gap <= 1 ? lastLen : 0;

  const isoStreaks = streaks.map((s) => ({
    startDate: new Date(s.start).toISOString().slice(0, 10),
    endDate: new Date(s.end).toISOString().slice(0, 10),
    length: diffDays(s.end, s.start) + 1,
    isActive: s === last && currentStreak > 0,
  }));

  return { currentStreak, longestStreak, streaks: isoStreaks };
}

/**
 * Completion rate = completed check-ins / elapsed expected periods.
 * Simplified: completed / total days since startDate (capped at 1).
 */
export async function computeCompletionRate(habit) {
  const completed = await Checkin.count({
    where: { habitId: habit.id, status: 'completed' },
  });
  const start = toDate(habit.startDate);
  const today = toDate(new Date().toISOString().slice(0, 10));
  const elapsed = Math.max(1, diffDays(today, start) + 1);
  return Math.min(1, completed / elapsed);
}
