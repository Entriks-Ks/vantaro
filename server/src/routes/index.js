import { Router } from 'express';
import healthRouter from './health.js';
import authRouter from './auth.js';
import contactRouter from './contact.js';
import dashboardRouter from './dashboard.js';
import leadsRouter from './leads.js';
import beraterRouter from './berater.js';

const router = Router();

router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use('/contact', contactRouter);
router.use('/dashboard', dashboardRouter);
router.use('/leads', leadsRouter);
router.use('/berater', beraterRouter);

export default router;
