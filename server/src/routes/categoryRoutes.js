import { Router } from 'express';
import {
  getCategoryController,
  listCategoriesController,
  listCategoryProductsController,
} from '../controllers/discoveryController.js';

const router = Router();
router.get('/', listCategoriesController);
router.get('/:slug/products', listCategoryProductsController);
router.get('/:slug', getCategoryController);

export default router;
