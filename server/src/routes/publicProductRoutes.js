import { Router } from 'express';
import {
  getPublicProductController,
  listPublicProductsController,
} from '../controllers/productController.js';

const router = Router();
router.get('/', listPublicProductsController);
router.get('/:slug', getPublicProductController);

export default router;
