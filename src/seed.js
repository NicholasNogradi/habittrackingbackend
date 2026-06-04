import { connectDatabase, sequelize } from './config/database.js';
import { User, Category, Habit, Checkin } from './models/index.js';

async function seed() {
  await connectDatabase();
  await sequelize.sync({ force: true });

  const user = await User.registerWithPassword({
    email: 'demo@habittrack.io',
    password: 'password123',
    displayName: 'Demo User',
    timezone: 'America/New_York',
  });

  const category = await Category.create({
    userId: user.id,
    name: 'Health & Fitness',
    color: '#4CAF50',
    icon: 'dumbbell',
  });

  const habit = await Habit.create({
    userId: user.id,
    categoryId: category.id,
    name: 'Morning Run',
    frequency: 'daily',
    targetCount: 1,
    unit: 'minutes',
    targetValue: 30,
    startDate: '2025-01-01',
  });

  // Create a 5-day completed streak ending today.
  const today = new Date();
  for (let i = 4; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86_400_000).toISOString().slice(0, 10);
    await Checkin.create({ habitId: habit.id, date: d, status: 'completed', value: 30 });
  }

  // eslint-disable-next-line no-console
  console.log('Seeded:');
  console.log('  email:    demo@habittrack.io');
  console.log('  password: password123');
  console.log(`  habitId:  ${habit.id}`);
  await sequelize.close();
}

seed();
