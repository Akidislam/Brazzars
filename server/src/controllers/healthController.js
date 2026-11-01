import { getDatabaseStatus } from '../config/database.js';

export function getHealth(_req, res) {
  res.status(200).json({
    success: true,
    message: 'Brazzars API is running',
    timestamp: new Date().toISOString(),
  });
}

export function getDatabaseHealth(_req, res) {
  const database = getDatabaseStatus();

  if (!database.connected) {
    return res.status(503).json({
      success: false,
      message: 'Database is not connected',
      database: database.state,
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Database connection is healthy',
    database: database.state,
  });
}
