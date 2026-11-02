import { Router } from 'express';
import {
  getPublicProductController,
  getPublicProductByIdController,
  listPublicProductsController,
} from '../controllers/productController.js';

const router = Router();
router.get('/', listPublicProductsController);
router.get('/id/:id', getPublicProductByIdController);
router.get('/:slug', getPublicProductController);

export default router;
