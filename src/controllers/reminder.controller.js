import { Reminder } from '../models/index.js';
import { findOwnedHabit } from './habit.controller.js';
import { NotFound } from '../utils/errors.js';

async function findOwnedReminder(userId, habitId, reminderId) {
  await findOwnedHabit(userId, habitId);
  const reminder = await Reminder.findOne({ where: { id: reminderId, habitId } });
  if (!reminder) throw NotFound('Reminder not found.');
  return reminder;
}

export async function listReminders(req, res, next) {
  try {
    await findOwnedHabit(req.user.id, req.params.habitId);
    const reminders = await Reminder.findAll({
      where: { habitId: req.params.habitId },
      order: [['time', 'ASC']],
    });
    return res.status(200).json(reminders.map((r) => r.toPublic()));
  } catch (err) {
    next(err);
  }
}

export async function createReminder(req, res, next) {
  try {
    await findOwnedHabit(req.user.id, req.params.habitId);
    const reminder = await Reminder.create({ ...req.body, habitId: req.params.habitId });
    res.setHeader('Location', `/v1/habits/${req.params.habitId}/reminders/${reminder.id}`);
    return res.status(201).json(reminder.toPublic());
  } catch (err) {
    next(err);
  }
}

export async function getReminder(req, res, next) {
  try {
    const reminder = await findOwnedReminder(req.user.id, req.params.habitId, req.params.reminderId);
    return res.status(200).json(reminder.toPublic());
  } catch (err) {
    next(err);
  }
}

export async function updateReminder(req, res, next) {
  try {
    const reminder = await findOwnedReminder(req.user.id, req.params.habitId, req.params.reminderId);
    await reminder.update(req.body);
    return res.status(200).json(reminder.toPublic());
  } catch (err) {
    next(err);
  }
}

export async function deleteReminder(req, res, next) {
  try {
    const reminder = await findOwnedReminder(req.user.id, req.params.habitId, req.params.reminderId);
    await reminder.destroy();
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
}
