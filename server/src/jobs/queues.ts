import { Queue, Worker } from 'bullmq';
import { getQueueConnection } from '../config/redis';
import { logger } from '../config/logger';
import { deliverEmail, type EmailPayload } from './mailer';
import { sendDueReminders } from './reminders';

let emailQueue: Queue<EmailPayload> | null = null;
let workerStarted = false;

export async function enqueueEmail(payload: EmailPayload) {
  if (!emailQueue) {
    await deliverEmail(payload);
    return;
  }

  await emailQueue.add('send', payload, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 100,
  });
}

export function startWorkers() {
  const connection = getQueueConnection();
  if (!connection || workerStarted) return;
  workerStarted = true;

  emailQueue = new Queue<EmailPayload>('email', { connection });

  new Worker<EmailPayload>(
    'email',
    async (job) => {
      await deliverEmail(job.data);
    },
    { connection },
  ).on('failed', (job, error) => {
    logger.error({ jobId: job?.id, error }, 'email job failed');
  });

  const reminders = new Queue('reminders', { connection });
  new Worker(
    'reminders',
    async () => {
      await sendDueReminders();
    },
    { connection },
  ).on('failed', (job, error) => {
    logger.error({ jobId: job?.id, error }, 'reminder job failed');
  });

  // One repeating scan. The job id keeps BullMQ from stacking duplicates.
  reminders
    .upsertJobScheduler('due-scan', { every: 15 * 60 * 1000 }, { name: 'scan', data: {} })
    .catch((error) => logger.error({ error }, 'could not schedule reminders'));
}
