import app from './app.js';
import { env } from './config/env.js';
import { connectDatabase } from './config/database.js';

async function startServer() {
  if (env.connectToDatabase) await connectDatabase();

  app.listen(env.port, () => {
    console.info(`Brazzars API listening on port ${env.port}`);
  });
}

startServer().catch((error) => {
  console.error('Unable to start Brazzars API:', error.message);
  process.exitCode = 1;
});
