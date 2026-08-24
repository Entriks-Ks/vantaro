import { Router } from 'express';
import { requireAuth } from '../lib/auth.js';
import { ROLES } from '../lib/roles.js';
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
      const directory = await listDirectoryUsers();
      payload.admin = {
        users: directory.counts,
        recentUsers: directory.recent,
        directory: directory.users,
        qualityQueue: 0,
        unmatched: 0,
      };
    } catch (error) {
      console.error('Dashboard admin payload failed:', error.message);
      payload.admin = {
        users: { total: 0, berater: 0, admin: 0, unverified: 0 },
        recentUsers: [],
        directory: [],
        qualityQueue: 0,
        unmatched: 0,
      };
    }
  }

  res.json(payload);
});

export default router;
