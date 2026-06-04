import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class Category extends Model {
  toPublic(habitCount = 0) {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      color: this.color,
      icon: this.icon,
      habitCount,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}

Category.init(
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
      type: DataTypes.STRING,
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
  },
  {
    sequelize,
    modelName: 'Category',
    tableName: 'categories',
    indexes: [{ unique: true, fields: ['userId', 'name'] }],
  }
);
