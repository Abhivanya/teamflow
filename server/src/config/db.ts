import mongoose from 'mongoose';
import { env } from './env';
import { logger } from './logger';

export async function connectDb(uri = env.MONGODB_URI) {
  mongoose.set('strictQuery', true);
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    try {
      await mongoose.connect(uri);
      logger.info('mongodb connected');
      return;
    } catch (error) {
      if (attempt === 10) throw error;
      logger.warn({ attempt }, 'mongodb not ready, retrying');
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
}
