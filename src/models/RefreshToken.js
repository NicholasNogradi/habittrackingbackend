import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

// Refresh tokens are stored as SHA-256 hashes (never plaintext).
// Supports rotation (replacedBy) and revocation (revokedAt).
export class RefreshToken extends Model {
  isActive() {
    return !this.revokedAt && new Date(this.expiresAt) > new Date();
  }
}

RefreshToken.init(
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
    tokenHash: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    revokedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    replacedByTokenHash: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'RefreshToken',
    tableName: 'refresh_tokens',
  }
);
