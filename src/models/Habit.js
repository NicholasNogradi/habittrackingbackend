import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class Habit extends Model {
  toPublic(extra = {}) {
    const {
      currentStreak = 0,
      longestStreak = 0,
      completionRate = null,
    } = extra;
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      categoryId: this.categoryId,
      color: this.color,
      icon: this.icon,
      frequency: this.frequency,
      targetDays: this.targetDays || [],
      targetCount: this.targetCount,
      unit: this.unit,
      targetValue: this.targetValue,
      status: this.status,
      startDate: this.startDate,
      endDate: this.endDate,
      currentStreak,
      longestStreak,
      completionRate,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}

Habit.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    categoryId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    color: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    icon: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    frequency: {
      type: DataTypes.ENUM('daily', 'weekly', 'custom'),
      allowNull: false,
    },
    // Stored as JSON array of weekday strings.
    targetDays: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    targetCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    unit: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    targetValue: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('active', 'paused', 'archived'),
      allowNull: false,
      defaultValue: 'active',
    },
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: () => new Date().toISOString().slice(0, 10),
    },
    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Habit',
    tableName: 'habits',
  }
);
