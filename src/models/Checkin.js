import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class Checkin extends Model {
  toPublic() {
    return {
      id: this.id,
      habitId: this.habitId,
      date: this.date,
      status: this.status,
      value: this.value,
      note: this.note,
      mood: this.mood,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}

Checkin.init(
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
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('completed', 'skipped', 'missed'),
      allowNull: false,
    },
    value: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    mood: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Checkin',
    tableName: 'checkins',
    indexes: [{ unique: true, fields: ['habitId', 'date'] }],
  }
);
