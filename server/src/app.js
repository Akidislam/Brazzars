import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import healthRoutes from './routes/healthRoutes.js';
import authRoutes from './routes/authRoutes.js';
import vendorProductRoutes from './routes/vendorProductRoutes.js';
import adminProductRoutes from './routes/adminProductRoutes.js';
import publicProductRoutes from './routes/publicProductRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import shopRoutes from './routes/shopRoutes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const app = express();

app.use(cors({ origin: env.clientOrigin }));
app.use(express.json());
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/vendor/products', vendorProductRoutes);
app.use('/api/admin/products', adminProductRoutes);
app.use('/api/products', publicProductRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/shops', shopRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
