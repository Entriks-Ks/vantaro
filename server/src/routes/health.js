import { Router } from 'express';
import { supabaseConfig, pingDatabase } from '../lib/supabase.js';

const router = Router();

router.get('/', async (_req, res) => {
  if (!supabaseConfig.configured) {
    return res.json({
      status: 'ok',
      service: 'vantaro-api',
      supabase: { configured: false, reachable: false },
    });
  }

  try {
    await pingDatabase();
    res.json({
      status: 'ok',
      service: 'vantaro-api',
      supabase: { configured: true, reachable: true },
    });
  } catch (error) {
    res.json({
      status: 'ok',
      service: 'vantaro-api',
      supabase: { configured: true, reachable: false, error: error.message },
    });
  }
});

export default router;
