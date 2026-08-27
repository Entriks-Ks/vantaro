import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import { getClientOrigins } from './lib/clientOrigin.js';
import { supabaseConfig } from './lib/supabase.js';

const app = express();
const PORT = process.env.PORT || 3001;
const CLIENT_ORIGINS = getClientOrigins();
const isDev = process.env.NODE_ENV !== 'production';

app.set('trust proxy', 1);

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (CLIENT_ORIGINS.includes(origin)) {
      callback(null, true);
      return;
    }

    if (isDev) {
      try {
        const { hostname } = new URL(origin);
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
          callback(null, true);
          return;
        }
      } catch {
        // fall through
      }
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '2mb' }));

app.use('/api', routes);

app.use((error, _req, res, _next) => {
  console.error('API error:', error);
  if (error?.message?.includes('Not allowed by CORS')) {
    res.status(403).json({ error: 'Origin nicht erlaubt.' });
    return;
  }
  res.status(500).json({ error: 'Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.' });
});

app.listen(PORT, () => {
  console.log(`VANTARO API listening on http://localhost:${PORT}`);
  console.log(`Allowed origins: ${CLIENT_ORIGINS.join(', ')}`);
  console.log(
    `Supabase: ${supabaseConfig.configured ? supabaseConfig.url : 'missing credentials'}`,
  );
});
