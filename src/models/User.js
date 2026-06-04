import crypto from 'node:crypto';
import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

const SCRYPT_KEYLEN = 64;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.startsWith('scrypt$')) return false;
  const [, salt, hash] = stored.split('$');
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(derived, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export class User extends Model {
  verifyPassword(password) {
    return verifyPassword(password, this.passwordHash);
  }

  // Public representation matching the OpenAPI `User` schema (no passwordHash).
  toPublic() {
    return {
      id: this.id,
      email: this.email,
      displayName: this.displayName,
      avatarUrl: this.avatarUrl,
      timezone: this.timezone,
      locale: this.locale,
      weekStartDay: this.weekStartDay,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    displayName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    avatarUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    timezone: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'UTC',
    },
    locale: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'en-US',
    },
    weekStartDay: {
      type: DataTypes.ENUM('monday', 'sunday'),
      allowNull: false,
      defaultValue: 'monday',
    },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
  }
);

User.registerWithPassword = async function registerWithPassword(attrs) {
  const { password, ...rest } = attrs;
  return User.create({ ...rest, passwordHash: hashPassword(password) });
};

export { hashPassword, verifyPassword };
