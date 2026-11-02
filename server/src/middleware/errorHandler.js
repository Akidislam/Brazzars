import mongoose from 'mongoose';
import { HttpError } from '../utils/httpError.js';

export function notFoundHandler(_req, res) {
  res.status(404).json({ success: false, message: 'Route not found' });
}

export function errorHandler(error, _req, res, _next) {
  let statusCode = 500;
  let message = 'Internal server error';

  if (error instanceof HttpError && (error.statusCode < 500 || error.expose)) {
    statusCode = error.statusCode;
    message = error.message;
  }

  if (error instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    message = 'Invalid request data.';
  } else if (error?.code === 11000) {
    statusCode = 409;
    message = 'A record with that value already exists.';
  } else if (error?.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Invalid JSON body.';
  }

  if (statusCode >= 500) console.error('Request failed with an internal error.');
  res.status(statusCode).json({ success: false, message });
}
