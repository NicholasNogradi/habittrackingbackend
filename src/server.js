import { createApp } from './app.js';
import { connectDatabase, sequelize } from './config/database.js';
import './models/index.js'; // ensure models + associations are registered
import { config } from './config/index.js';

async function start() {
  try {
    await connectDatabase();
    // In development we auto-sync the schema. Use migrations in production.
    await sequelize.sync();
    // eslint-disable-next-line no-console
    console.log('Database connected and synced.');

    const app = createApp();
    app.listen(config.port, () => {
      // eslint-disable-next-line no-console
      console.log(`Habit Tracking API listening on http://localhost:${config.port}`);
      console.log(`Base URL: http://localhost:${config.port}/v1`);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
