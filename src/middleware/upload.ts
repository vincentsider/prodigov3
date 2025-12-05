import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';

const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || '50', 10);
const MOUNT_PATH = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(process.cwd(), 'uploads');

// Ensure upload directory exists
fs.ensureDirSync(MOUNT_PATH);

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Organize by date: YYYY/MM/DD
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        // We can't access req.body.customer_id here reliably because multer processes fields in order.
        // So we'll stick to date-based structure for the physical file, 
        // and maybe move it later or just keep it there.
        // The PRD suggests: /data/uploads/{yyyy}/{mm}/{dd}/{customer_or_source}/{file_id}-{sanitized_filename}
        // But without customer_id guaranteed to be available before file, we might need to rely on just date first.
        // Let's stick to date for now to be safe.

        const uploadPath = path.join(MOUNT_PATH, String(year), month, day);
        fs.ensureDirSync(uploadPath);
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const fileId = `file_${uuidv4()}`;
        // Sanitize filename
        const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, `${fileId}-${sanitizedFilename}`);
    }
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // PRD allowed types: json, csv, plain, pdf, zip
    const allowedTypes = [
        'application/json',
        'text/csv',
        'text/plain',
        'application/pdf',
        'application/zip',
        'application/x-zip-compressed' // sometimes zip comes as this
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Unsupported file type'));
    }
};

export const upload = multer({
    storage: storage,
    limits: {
        fileSize: MAX_UPLOAD_MB * 1024 * 1024 // Convert MB to bytes
    },
    fileFilter: fileFilter
});
