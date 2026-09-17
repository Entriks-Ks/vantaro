import { Router } from 'express';
import { sendSupportEmail } from '../lib/mailer.js';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const { name, email, category, subject, message } = req.body ?? {};

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'Bitte füllen Sie alle Pflichtfelder aus.' });
    }

    // Send support email
    await sendSupportEmail({
      name,
      email,
      category,
      subject,
      message,
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Support request error:', error);
    res.status(500).json({ error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.' });
  }
});

export default router;
