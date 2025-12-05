import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import filesRouter from './routes/files';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/v1/files', filesRouter);

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Volume Mount Path: ${process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(process.cwd(), 'uploads')}`);
});
