import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class Reminder extends Model {
  toPublic() {
    return {
      id: this.id,
      habitId: this.habitId,
      time: this.time,
      daysOfWeek: this.daysOfWeek || [],
      channel: this.channel,
      message: this.message,
      isEnabled: this.isEnabled,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}

Reminder.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    habitId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    time: {
      type: DataTypes.STRING, // "HH:mm"
      allowNull: false,
    },
    daysOfWeek: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    channel: {
      type: DataTypes.ENUM('push', 'email', 'sms'),
      allowNull: false,
    },
    message: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    isEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize,
    modelName: 'Reminder',
    tableName: 'reminders',
  }
);
