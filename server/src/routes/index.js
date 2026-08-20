import { Router } from 'express';
import healthRouter from './health.js';
import authRouter from './auth.js';
import contactRouter from './contact.js';

const router = Router();

router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use('/contact', contactRouter);

export default router;
