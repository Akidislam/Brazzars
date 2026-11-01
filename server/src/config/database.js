import mongoose from 'mongoose';
import { env } from './env.js';

let connectionAttempt;

const DATABASE_CONNECTION_ERROR =
  'MongoDB connection failed. Check the Atlas URI, network access, and credentials.';

function validateMongoUri(uri) {
  if (typeof uri !== 'string' || uri.trim() === '') {
    throw new Error('MONGODB_URI must be configured before connecting to MongoDB.');
  }

  let parsedUri;
  try {
    parsedUri = new URL(uri);
  } catch {
    throw new Error('MONGODB_URI is not a valid MongoDB connection string.');
  }

  if (!['mongodb:', 'mongodb+srv:'].includes(parsedUri.protocol) || !parsedUri.hostname) {
    throw new Error('MONGODB_URI is not a valid MongoDB connection string.');
  }

  if (/[<>]|YOUR_USERNAME|YOUR_PASSWORD|YOUR_CLUSTER|YOUR_DATABASE/i.test(uri)) {
    throw new Error('Replace the MONGODB_URI placeholders with your Atlas connection details.');
  }
}

// This function is intentionally opt-in; it is only called when CONNECT_TO_DATABASE=true.
export async function connectDatabase() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (connectionAttempt) return connectionAttempt;

  validateMongoUri(env.mongoUri);

  connectionAttempt = Promise.resolve()
    .then(() => mongoose.connect(env.mongoUri))
    .then(() => {
      console.info('MongoDB connection established.');
      return mongoose.connection;
    })
    .catch(() => {
      // Do not forward Mongoose's error: it can include the connection string.
      throw new Error(DATABASE_CONNECTION_ERROR);
    })
    .finally(() => {
      connectionAttempt = undefined;
    });

  return connectionAttempt;
}

export function getDatabaseStatus() {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  const state = states[mongoose.connection.readyState] ?? 'unknown';
  return { connected: state === 'connected', state };
}
