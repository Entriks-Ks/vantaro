import { Router } from 'express';
import { requireAuth } from '../lib/auth.js';
import { ROLES } from '../lib/roles.js';
import { countLeadStats } from '../lib/leads.js';
import { listDirectoryUsers } from '../lib/users.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const payload = {
    user: req.user,
    stats: {
      newChances: 0,
      appointments: 0,
      openTasks: 0,
      creditCents: 0,
    },
  };

  if (req.user.role === ROLES.ADMIN) {
    try {
      const [directory, leads] = await Promise.all([
        listDirectoryUsers(),
        countLeadStats(),
      ]);
      payload.admin = {
        users: directory.counts,
        recentUsers: directory.recent,
        directory: directory.users,
        qualityQueue: leads.qualityQueue,
        unmatched: leads.unmatched,
        leadTotal: leads.total,
        recentLeads: leads.recent,
      };
    } catch (error) {
      console.error('Dashboard admin payload failed:', error.message);
      payload.admin = {
        users: { total: 0, berater: 0, admin: 0, unverified: 0 },
        recentUsers: [],
        directory: [],
        qualityQueue: 0,
        unmatched: 0,
        leadTotal: 0,
        recentLeads: [],
      };
    }
  }

  res.json(payload);
});

export default router;
