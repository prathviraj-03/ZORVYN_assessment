import multer from 'multer';
import { Errors } from '@/lib/errors';

const ALLOWED_MIMETYPES = [
  'text/csv',
  'application/json',
  'application/vnd.ms-excel', // some OS sends CSV with this
  'text/plain', // some OS sends CSV with this
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (!ALLOWED_MIMETYPES.includes(file.mimetype) && ext !== 'csv' && ext !== 'json') {
      return cb(Errors.BAD_REQUEST('Only .csv and .json files are allowed'));
    }
    cb(null, true);
  },
});
