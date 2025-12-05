import { Request, Response, NextFunction } from 'express';

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const apiKey = process.env.API_AUTH_KEY;

    if (!apiKey) {
        console.error('API_AUTH_KEY is not set');
        return res.status(500).json({ error: 'Internal Server Error' });
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
    }

    const token = authHeader.split(' ')[1];

    if (token !== apiKey) {
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    next();
};
