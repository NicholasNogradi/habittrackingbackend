import fs from 'node:fs';
import path from 'node:path';
import { Sequelize } from 'sequelize';
import { config } from './index.js';

// Ensure the directory for the SQLite file exists (skip for :memory:).
if (config.db.storage !== ':memory:') {
  const dir = path.dirname(config.db.storage);
  if (dir && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: config.db.storage,
  logging: config.env === 'development' ? false : false,
  define: {
    underscored: false,
    timestamps: true,
  },
});

export async function connectDatabase() {
  await sequelize.authenticate();
  // Enforce foreign keys in SQLite (off by default).
  await sequelize.query('PRAGMA foreign_keys = ON;');
}
