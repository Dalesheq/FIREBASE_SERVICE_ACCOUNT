import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { photoRouter } from './server/photoRoutes';
import { reportRouter } from './server/reportRoutes';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // CORS Configuration:
  // In production, strictly restrict origin to FRONTEND_ORIGIN (e.g. Firebase Hosting).
  // In development, permit localhost dev origins and same-origin requests.
  const frontendOrigin = process.env.FRONTEND_ORIGIN?.trim();

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, server-to-server)
        if (!origin) {
          return callback(null, true);
        }

        if (process.env.NODE_ENV !== 'production' || !frontendOrigin) {
          // In development or when FRONTEND_ORIGIN is unset, permit dev origins and container preview
          if (
            origin.startsWith('http://localhost:') ||
            origin.startsWith('http://127.0.0.1:') ||
            origin.includes('.run.app') ||
            !frontendOrigin
          ) {
            return callback(null, true);
          }
        }

        // In production, match configured frontend origin(s)
        if (frontendOrigin) {
          const allowedOrigins = frontendOrigin
            .split(',')
            .map((o) => o.trim().replace(/\/$/, ''))
            .filter(Boolean);

          const normalizedOrigin = origin.replace(/\/$/, '');
          if (allowedOrigins.includes(normalizedOrigin)) {
            return callback(null, true);
          }
        }

        // Reject other origins in production (never use '*')
        return callback(new Error(`CORS policy does not allow access from origin: ${origin}`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // Security response headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Middleware for parsing JSON with limit for compressed image uploads
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // Public Health endpoint (no auth required - for Render health checks and monitors)
  app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Photo management API (Supabase Storage + Firebase Auth & Firestore)
  app.use('/api/photos', photoRouter);

  // PDF Reporting API (PDFKit + Supabase Storage + Admin Auth)
  app.use('/api/reports', reportRouter);

  // Safe global error handler (never leaks stack traces or secrets in production)
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err.message && err.message.startsWith('CORS policy')) {
      return res.status(403).json({ error: 'Origin not allowed by CORS policy' });
    }
    const isProd = process.env.NODE_ENV === 'production';
    const message = isProd ? 'Internal Server Error' : err.message || 'Unknown error';
    res.status(err.status || 500).json({ error: message });
  });

  // Vite middleware for development vs static build in production (only if serving SPA from same node)
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    // If running as a standalone API on Render, static dist may or may not exist.
    // If dist exists, serve static assets as fallback.
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        return next();
      }
      res.sendFile(path.join(distPath, 'index.html'), (err) => {
        if (err) {
          // If index.html is absent (e.g. backend-only deploy), return 404 for non-API routes
          res.status(404).json({ error: 'Endpoint not found' });
        }
      });
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SHEQ Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
