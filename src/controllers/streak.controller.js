import { findOwnedHabit } from './habit.controller.js';
import { computeStreaks } from '../services/streak.service.js';
import { encodeCursor } from '../services/pagination.js';
import { NotFound } from '../utils/errors.js';

export async function listStreaks(req, res, next) {
  try {
    await findOwnedHabit(req.user.id, req.params.habitId);
    const { limit = 20, cursor } = req.query;
    const { streaks } = await computeStreaks(req.params.habitId);

    // Streaks are computed, not stored; paginate the in-memory array.
    const startIdx = cursor ? Number(Buffer.from(cursor, 'base64url').toString('utf8')) || 0 : 0;
    const page = streaks
      .slice()
      .reverse() // newest first
      .slice(startIdx, startIdx + limit)
      .map((s, i) => ({ id: `${req.params.habitId}-${startIdx + i}`, habitId: req.params.habitId, ...s }));

    const hasMore = startIdx + limit < streaks.length;
    return res.status(200).json({
      data: page,
      pagination: {
        totalCount: streaks.length,
        hasMore,
        nextCursor: hasMore ? encodeCursorIndex(startIdx + limit) : null,
        prevCursor: cursor || null,
      },
    });
  } catch (err) {
    next(err);
  }
}

function encodeCursorIndex(n) {
  return Buffer.from(String(n), 'utf8').toString('base64url');
}

export async function getCurrentStreak(req, res, next) {
  try {
    await findOwnedHabit(req.user.id, req.params.habitId);
    const { streaks, currentStreak } = await computeStreaks(req.params.habitId);
    const active = streaks.find((s) => s.isActive);
    if (!active) {
      // No active streak — return a zero-length representation.
      const today = new Date().toISOString().slice(0, 10);
      return res.status(200).json({
        id: `${req.params.habitId}-current`,
        habitId: req.params.habitId,
        startDate: today,
        endDate: null,
        length: 0,
        isActive: false,
      });
    }
    return res.status(200).json({
      id: `${req.params.habitId}-current`,
      habitId: req.params.habitId,
      startDate: active.startDate,
      endDate: null,
      length: currentStreak,
      isActive: true,
    });
  } catch (err) {
    next(err);
  }
}
