import app from './app.js';
import { config } from './config.js';

const bootstrap = async () => {
  app.listen(config.port, () => {
    console.log(`[gifts-backend] listening on http://localhost:${config.port}`);
  });
};

bootstrap().catch((error) => {
  console.error('[gifts-backend] failed to start', error.message);
  process.exit(1);
});
