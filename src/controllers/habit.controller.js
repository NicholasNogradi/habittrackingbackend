import { Op } from 'sequelize';
import { Habit } from '../models/index.js';
import { paginate } from '../services/pagination.js';
import { computeStreaks, computeCompletionRate } from '../services/streak.service.js';
import { setETag, setLastModified, enforceIfMatch } from '../middleware/etag.js';
import { NotFound } from '../utils/errors.js';

async function findOwned(userId, habitId) {
  const habit = await Habit.findOne({ where: { id: habitId, userId } });
  if (!habit) throw NotFound('Habit not found.');
  return habit;
}

async function enrich(habit) {
  const { currentStreak, longestStreak } = await computeStreaks(habit.id);
  const completionRate = await computeCompletionRate(habit);
  return habit.toPublic({ currentStreak, longestStreak, completionRate });
}

export async function listHabits(req, res, next) {
  try {
    const { limit, cursor, categoryId, status, frequency, sort } = req.query;

    const where = { userId: req.user.id };
    if (categoryId) where.categoryId = categoryId;
    if (status) where.status = status;
    if (frequency) where.frequency = frequency;

    // Name/createdAt sorts can be done in SQL; streak sorts are computed,
    // so we fall back to createdAt keyset paging and note the limitation.
    const result = await paginate(Habit, { where, limit, cursor }, null);

    const data = [];
    for (const habit of result.data) {
      data.push(await enrich(habit));
    }

    // Apply in-memory sort for non-default fields within the page.
    if (sort && sort !== '-createdAt') {
      const dir = sort.startsWith('-') ? -1 : 1;
      const field = sort.replace('-', '');
      data.sort((a, b) => {
        if (field === 'name') return dir * a.name.localeCompare(b.name);
        if (field === 'streak') return dir * (a.currentStreak - b.currentStreak);
        if (field === 'createdAt') return dir * a.createdAt.localeCompare(b.createdAt);
        return 0;
      });
    }

    return res.status(200).json({ data, pagination: result.pagination });
  } catch (err) {
    next(err);
  }
}

export async function createHabit(req, res, next) {
  try {
    const habit = await Habit.create({ ...req.body, userId: req.user.id });
    res.setHeader('Location', `/v1/habits/${habit.id}`);
    setETag(res, habit);
    return res.status(201).json(await enrich(habit));
  } catch (err) {
    next(err);
  }
}

export async function getHabit(req, res, next) {
  try {
    const habit = await findOwned(req.user.id, req.params.habitId);
    setETag(res, habit);
    setLastModified(res, habit);
    return res.status(200).json(await enrich(habit));
  } catch (err) {
    next(err);
  }
}

// PUT — full replacement.
export async function replaceHabit(req, res, next) {
  try {
    const habit = await findOwned(req.user.id, req.params.habitId);
    enforceIfMatch(req, habit);
    // Reset nullable fields not present in the body to defaults for a true replace.
    const replacement = {
      name: req.body.name,
      description: req.body.description ?? null,
      categoryId: req.body.categoryId ?? null,
      color: req.body.color ?? null,
      icon: req.body.icon ?? null,
      frequency: req.body.frequency,
      targetDays: req.body.targetDays ?? null,
      targetCount: req.body.targetCount ?? 1,
      unit: req.body.unit ?? null,
      targetValue: req.body.targetValue ?? null,
      startDate: req.body.startDate ?? habit.startDate,
      endDate: req.body.endDate ?? null,
    };
    await habit.update(replacement);
    setETag(res, habit);
    return res.status(200).json(await enrich(habit));
  } catch (err) {
    next(err);
  }
}

// PATCH — partial update.
export async function updateHabit(req, res, next) {
  try {
    const habit = await findOwned(req.user.id, req.params.habitId);
    enforceIfMatch(req, habit);
    await habit.update(req.body);
    setETag(res, habit);
    return res.status(200).json(await enrich(habit));
  } catch (err) {
    next(err);
  }
}

export async function deleteHabit(req, res, next) {
  try {
    const habit = await findOwned(req.user.id, req.params.habitId);
    await habit.destroy(); // cascades to checkins + reminders
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export { findOwned as findOwnedHabit };
