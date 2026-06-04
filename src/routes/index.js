import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { idempotency } from '../middleware/idempotency.js';
import { validateBody, validateQuery, validateParams } from '../middleware/validate.js';

import { userUpdateSchema } from '../schemas/user.schema.js';
import { categoryCreateSchema, categoryUpdateSchema } from '../schemas/category.schema.js';
import {
  habitCreateSchema,
  habitUpdateSchema,
  habitListQuerySchema,
} from '../schemas/habit.schema.js';
import {
  checkinCreateSchema,
  checkinUpdateSchema,
  checkinListQuerySchema,
} from '../schemas/checkin.schema.js';
import {
  reminderCreateSchema,
  reminderUpdateSchema,
  analyticsSummaryQuerySchema,
  habitTrendsQuerySchema,
} from '../schemas/reminder.schema.js';
import { paginationQuery, idParam } from '../schemas/common.schema.js';

import * as users from '../controllers/user.controller.js';
import * as categories from '../controllers/category.controller.js';
import * as habits from '../controllers/habit.controller.js';
import * as checkins from '../controllers/checkin.controller.js';
import * as streaks from '../controllers/streak.controller.js';
import * as reminders from '../controllers/reminder.controller.js';
import * as analytics from '../controllers/analytics.controller.js';

export const apiRouter = Router();

// Everything below requires a valid bearer token.
apiRouter.use(requireAuth);

// ── Users ────────────────────────────────────────────────────────────────────
apiRouter.get('/users/me', users.getCurrentUser);
apiRouter.patch('/users/me', validateBody(userUpdateSchema), users.updateCurrentUser);
apiRouter.delete('/users/me', users.deleteCurrentUser);

// ── Categories ────────────────────────────────────────────────────────────────
apiRouter.get('/categories', validateQuery(paginationQuery), categories.listCategories);
apiRouter.post('/categories', idempotency, validateBody(categoryCreateSchema), categories.createCategory);
apiRouter.get(
  '/categories/:categoryId',
  validateParams(idParam('categoryId')),
  categories.getCategory
);
apiRouter.patch(
  '/categories/:categoryId',
  validateParams(idParam('categoryId')),
  validateBody(categoryUpdateSchema),
  categories.updateCategory
);
apiRouter.delete(
  '/categories/:categoryId',
  validateParams(idParam('categoryId')),
  categories.deleteCategory
);

// ── Habits ────────────────────────────────────────────────────────────────────
apiRouter.get('/habits', validateQuery(habitListQuerySchema), habits.listHabits);
apiRouter.post('/habits', idempotency, validateBody(habitCreateSchema), habits.createHabit);
apiRouter.get('/habits/:habitId', validateParams(idParam('habitId')), habits.getHabit);
apiRouter.put(
  '/habits/:habitId',
  validateParams(idParam('habitId')),
  validateBody(habitCreateSchema),
  habits.replaceHabit
);
apiRouter.patch(
  '/habits/:habitId',
  validateParams(idParam('habitId')),
  validateBody(habitUpdateSchema),
  habits.updateHabit
);
apiRouter.delete('/habits/:habitId', validateParams(idParam('habitId')), habits.deleteHabit);

// ── Check-ins ───────────────────────────────────────────────────────────────
apiRouter.get(
  '/habits/:habitId/checkins',
  validateParams(idParam('habitId')),
  validateQuery(checkinListQuerySchema),
  checkins.listCheckins
);
apiRouter.post(
  '/habits/:habitId/checkins',
  idempotency,
  validateParams(idParam('habitId')),
  validateBody(checkinCreateSchema),
  checkins.createCheckin
);
apiRouter.get(
  '/habits/:habitId/checkins/:checkinId',
  validateParams(idParam('habitId').merge(idParam('checkinId'))),
  checkins.getCheckin
);
apiRouter.patch(
  '/habits/:habitId/checkins/:checkinId',
  validateParams(idParam('habitId').merge(idParam('checkinId'))),
  validateBody(checkinUpdateSchema),
  checkins.updateCheckin
);
apiRouter.delete(
  '/habits/:habitId/checkins/:checkinId',
  validateParams(idParam('habitId').merge(idParam('checkinId'))),
  checkins.deleteCheckin
);

// ── Streaks ───────────────────────────────────────────────────────────────────
apiRouter.get(
  '/habits/:habitId/streaks',
  validateParams(idParam('habitId')),
  validateQuery(paginationQuery),
  streaks.listStreaks
);
apiRouter.get(
  '/habits/:habitId/streaks/current',
  validateParams(idParam('habitId')),
  streaks.getCurrentStreak
);

// ── Reminders ─────────────────────────────────────────────────────────────────
apiRouter.get(
  '/habits/:habitId/reminders',
  validateParams(idParam('habitId')),
  reminders.listReminders
);
apiRouter.post(
  '/habits/:habitId/reminders',
  idempotency,
  validateParams(idParam('habitId')),
  validateBody(reminderCreateSchema),
  reminders.createReminder
);
apiRouter.get(
  '/habits/:habitId/reminders/:reminderId',
  validateParams(idParam('habitId').merge(idParam('reminderId'))),
  reminders.getReminder
);
apiRouter.patch(
  '/habits/:habitId/reminders/:reminderId',
  validateParams(idParam('habitId').merge(idParam('reminderId'))),
  validateBody(reminderUpdateSchema),
  reminders.updateReminder
);
apiRouter.delete(
  '/habits/:habitId/reminders/:reminderId',
  validateParams(idParam('habitId').merge(idParam('reminderId'))),
  reminders.deleteReminder
);

// ── Analytics ─────────────────────────────────────────────────────────────────
apiRouter.get(
  '/analytics/summary',
  validateQuery(analyticsSummaryQuerySchema),
  analytics.getAnalyticsSummary
);
apiRouter.get(
  '/analytics/habits/:habitId/trends',
  validateParams(idParam('habitId')),
  validateQuery(habitTrendsQuerySchema),
  analytics.getHabitTrends
);
