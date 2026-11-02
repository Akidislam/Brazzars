import { Router } from 'express';
import {
  getShopController,
  listShopProductsController,
  listShopsController,
} from '../controllers/discoveryController.js';

const router = Router();
router.get('/', listShopsController);
router.get('/:slug/products', listShopProductsController);
router.get('/:slug', getShopController);

export default router;
