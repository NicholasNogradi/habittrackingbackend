import { Op } from 'sequelize';
import { Checkin } from '../models/index.js';
import { findOwnedHabit } from './habit.controller.js';
import { paginate } from '../services/pagination.js';
import { setETag, enforceIfMatch } from '../middleware/etag.js';
import { NotFound, Conflict } from '../utils/errors.js';

async function findOwnedCheckin(userId, habitId, checkinId) {
  await findOwnedHabit(userId, habitId); // 404 if habit not owned
  const checkin = await Checkin.findOne({ where: { id: checkinId, habitId } });
  if (!checkin) throw NotFound('Check-in not found.');
  return checkin;
}

export async function listCheckins(req, res, next) {
  try {
    await findOwnedHabit(req.user.id, req.params.habitId);
    const { limit, cursor, from, to, status } = req.query;

    const where = { habitId: req.params.habitId };
    if (status) where.status = status;
    if (from || to) {
      where.date = {};
      if (from) where.date[Op.gte] = from;
      if (to) where.date[Op.lte] = to;
    }

    const result = await paginate(Checkin, { where, limit, cursor }, (c) => c.toPublic());
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function createCheckin(req, res, next) {
  try {
    await findOwnedHabit(req.user.id, req.params.habitId);

    const existing = await Checkin.findOne({
      where: { habitId: req.params.habitId, date: req.body.date },
    });
    if (existing) {
      throw Conflict('A check-in already exists for this habit on this date.');
    }

    const checkin = await Checkin.create({ ...req.body, habitId: req.params.habitId });
    res.setHeader('Location', `/v1/habits/${req.params.habitId}/checkins/${checkin.id}`);
    setETag(res, checkin);
    return res.status(201).json(checkin.toPublic());
  } catch (err) {
    next(err);
  }
}

export async function getCheckin(req, res, next) {
  try {
    const checkin = await findOwnedCheckin(req.user.id, req.params.habitId, req.params.checkinId);
    setETag(res, checkin);
    return res.status(200).json(checkin.toPublic());
  } catch (err) {
    next(err);
  }
}

export async function updateCheckin(req, res, next) {
  try {
    const checkin = await findOwnedCheckin(req.user.id, req.params.habitId, req.params.checkinId);
    enforceIfMatch(req, checkin);
    await checkin.update(req.body);
    setETag(res, checkin);
    return res.status(200).json(checkin.toPublic());
  } catch (err) {
    next(err);
  }
}

export async function deleteCheckin(req, res, next) {
  try {
    const checkin = await findOwnedCheckin(req.user.id, req.params.habitId, req.params.checkinId);
    await checkin.destroy();
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
}
