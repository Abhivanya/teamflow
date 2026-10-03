import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import multer from 'multer';
import { env } from '../config/env';

const ALLOWED = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
]);

export function uploadDir() {
  if (env.UPLOAD_DIR) return path.resolve(env.UPLOAD_DIR);
  return path.resolve(__dirname, '../../uploads');
}

export function ensureUploadDir() {
  fs.mkdirSync(uploadDir(), { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir()),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 8);
    const safeExt = /^\.[a-z0-9]+$/.test(ext) ? ext : '';
    cb(null, `${Date.now()}-${randomBytes(8).toString('hex')}${safeExt}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) {
      cb(new Error('File type is not allowed'));
      return;
    }
    cb(null, true);
  },
});
