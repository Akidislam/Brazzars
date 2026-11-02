export class HttpError extends Error {
  constructor(statusCode, message, { expose = false } = {}) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.expose = expose;
  }
}
