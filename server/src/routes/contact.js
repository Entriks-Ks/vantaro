import { Router } from 'express';

const router = Router();

router.post('/', (req, res) => {
  const { name, email, company, focus, message } = req.body ?? {};

  if (!name || !email) {
    return res.status(400).json({ error: 'Name und E-Mail sind erforderlich.' });
  }

  console.log('Contact request:', { name, email, company, focus, message });
  res.status(501).json({ error: 'Kontaktformular-API ist noch nicht implementiert.' });
});

export default router;
