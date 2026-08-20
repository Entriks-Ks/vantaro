import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import { supabaseConfig } from './lib/supabase.js';

const app = express();
const PORT = process.env.PORT || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

app.use('/api', routes);

app.use((error, _req, res, _next) => {
  console.error('API error:', error);
  res.status(500).json({ error: 'Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.' });
});

app.listen(PORT, () => {
  console.log(`VANTARO API listening on http://localhost:${PORT}`);
  console.log(
    `Supabase: ${supabaseConfig.configured ? supabaseConfig.url : 'missing credentials'}`,
  );
});

