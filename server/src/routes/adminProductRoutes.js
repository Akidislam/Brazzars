import { Router } from 'express';
import {
  approveProductController,
  getAdminProductController,
  listAdminProductsController,
  listPendingProductsController,
  rejectProductController,
  setAdminProductStatusController,
} from '../controllers/productController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';

const router = Router();
router.use(authenticate, authorizeRoles('admin'));
router.get('/', listAdminProductsController);
router.get('/pending', listPendingProductsController);
router.get('/:id', getAdminProductController);
router.patch('/:id/approve', approveProductController);
router.patch('/:id/reject', rejectProductController);
router.patch('/:id/status', setAdminProductStatusController);

export default router;
