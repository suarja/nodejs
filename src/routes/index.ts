import express, { Request, Response } from 'express';
import path from 'path';

const router = express.Router();

// Serve the index.html file for the root route
router.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../../views/index.html'));
});

export default router; 