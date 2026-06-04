import { sequelize } from '../config/database.js';
import { User } from './User.js';
import { Category } from './Category.js';
import { Habit } from './Habit.js';
import { Checkin } from './Checkin.js';
import { Reminder } from './Reminder.js';
import { RefreshToken } from './RefreshToken.js';

// ── Associations ─────────────────────────────────────────────────────────────
User.hasMany(Category, { foreignKey: 'userId', onDelete: 'CASCADE' });
Category.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Habit, { foreignKey: 'userId', onDelete: 'CASCADE' });
Habit.belongsTo(User, { foreignKey: 'userId' });

// Deleting a category nulls out the habit's categoryId (per spec).
Category.hasMany(Habit, { foreignKey: 'categoryId', onDelete: 'SET NULL' });
Habit.belongsTo(Category, { foreignKey: 'categoryId' });

Habit.hasMany(Checkin, { foreignKey: 'habitId', onDelete: 'CASCADE' });
Checkin.belongsTo(Habit, { foreignKey: 'habitId' });

Habit.hasMany(Reminder, { foreignKey: 'habitId', onDelete: 'CASCADE' });
Reminder.belongsTo(Habit, { foreignKey: 'habitId' });

User.hasMany(RefreshToken, { foreignKey: 'userId', onDelete: 'CASCADE' });
RefreshToken.belongsTo(User, { foreignKey: 'userId' });

export { sequelize, User, Category, Habit, Checkin, Reminder, RefreshToken };
