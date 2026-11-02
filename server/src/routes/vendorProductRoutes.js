import { Router } from 'express';
import {
  createVendorProductController,
  deleteVendorProductController,
  getVendorProductController,
  listVendorProductsController,
  updateVendorProductController,
} from '../controllers/productController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';

const router = Router();
router.use(authenticate, authorizeRoles('vendor'));
router.route('/').post(createVendorProductController).get(listVendorProductsController);
router.route('/:id').get(getVendorProductController).patch(updateVendorProductController).delete(deleteVendorProductController);

export default router;
