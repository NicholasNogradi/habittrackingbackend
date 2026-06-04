import { Op } from 'sequelize';
import { Habit, Checkin } from '../models/index.js';
import { findOwnedHabit } from './habit.controller.js';
import { computeStreaks } from '../services/streak.service.js';

const DAY_MS = 86_400_000;

function daysBetween(from, to) {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS) + 1;
}

export async function getAnalyticsSummary(req, res, next) {
  try {
    const { from, to } = req.query;
    const habits = await Habit.findAll({ where: { userId: req.user.id } });
    const habitIds = habits.map((h) => h.id);

    const totalCheckins = habitIds.length
      ? await Checkin.count({
          where: {
            habitId: { [Op.in]: habitIds },
            status: 'completed',
            date: { [Op.gte]: from, [Op.lte]: to },
          },
        })
      : 0;

    const periodDays = Math.max(1, daysBetween(from, to));
    const expected = habits.length * periodDays;
    const completionRate = expected ? Math.min(1, totalCheckins / expected) : 0;

    let longestStreak = 0;
    let currentStreak = 0;
    const perHabit = [];
    for (const habit of habits) {
      const { currentStreak: cur, longestStreak: lng } = await computeStreaks(habit.id);
      longestStreak = Math.max(longestStreak, lng);
      currentStreak = Math.max(currentStreak, cur);

      const count = await Checkin.count({
        where: {
          habitId: habit.id,
          status: 'completed',
          date: { [Op.gte]: from, [Op.lte]: to },
        },
      });
      perHabit.push({
        habitId: habit.id,
        habitName: habit.name,
        completionRate: periodDays ? Math.min(1, count / periodDays) : 0,
        checkinsCount: count,
      });
    }

    perHabit.sort((a, b) => b.completionRate - a.completionRate);

    return res.status(200).json({
      periodStart: from,
      periodEnd: to,
      totalHabits: habits.length,
      activeHabits: habits.filter((h) => h.status === 'active').length,
      totalCheckins,
      completionRate,
      longestStreak,
      currentStreak,
      topHabits: perHabit.slice(0, 5),
    });
  } catch (err) {
    next(err);
  }
}

export async function getHabitTrends(req, res, next) {
  try {
    await findOwnedHabit(req.user.id, req.params.habitId);
    const { from, to, granularity } = req.query;

    const checkins = await Checkin.findAll({
      where: {
        habitId: req.params.habitId,
        status: 'completed',
        date: { [Op.gte]: from, [Op.lte]: to },
      },
      order: [['date', 'ASC']],
      attributes: ['date'],
    });

    const buckets = bucketByGranularity(from, to, granularity, checkins.map((c) => c.date));

    return res.status(200).json({
      habitId: req.params.habitId,
      granularity,
      dataPoints: buckets,
    });
  } catch (err) {
    next(err);
  }
}

function bucketByGranularity(from, to, granularity, dates) {
  const points = [];
  const start = new Date(from + 'T00:00:00Z');
  const end = new Date(to + 'T00:00:00Z');
  const dateSet = new Set(dates);

  let cursor = new Date(start);
  while (cursor <= end) {
    const periodStart = cursor.toISOString().slice(0, 10);
    let next;
    if (granularity === 'daily') {
      next = new Date(cursor.getTime() + DAY_MS);
    } else if (granularity === 'monthly') {
      next = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, cursor.getUTCDate()));
    } else {
      next = new Date(cursor.getTime() + 7 * DAY_MS);
    }

    let count = 0;
    let totalDays = 0;
    for (let d = new Date(cursor); d < next && d <= end; d = new Date(d.getTime() + DAY_MS)) {
      totalDays += 1;
      if (dateSet.has(d.toISOString().slice(0, 10))) count += 1;
    }

    points.push({
      periodStart,
      completionRate: totalDays ? Math.min(1, count / totalDays) : 0,
      checkinsCount: count,
    });
    cursor = next;
  }
  return points;
}
