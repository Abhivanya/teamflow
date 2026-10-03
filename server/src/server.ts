import http from 'http';
import { createApp } from './app';
import { connectDb } from './config/db';
import { env } from './config/env';
import { logger } from './config/logger';
import { connectRedis } from './config/redis';
import { startWorkers } from './jobs/queues';
import { attachSocket } from './sockets/io';
import { ensureUploadDir } from './services/upload';

const app = createApp();
const server = http.createServer(app);

async function main() {
  await connectDb();
  await connectRedis();
  ensureUploadDir();
  startWorkers();
  attachSocket(server);
  server.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'api listening');
  });
}

main().catch((error) => {
  logger.error({ error }, 'api failed to start');
  process.exit(1);
});
