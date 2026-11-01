import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: Number.parseInt(process.env.PORT ?? '5000', 10),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  mongoUri: process.env.MONGODB_URI,
  connectToDatabase: process.env.CONNECT_TO_DATABASE === 'true',
  jwtSecret: process.env.JWT_SECRET,
};
