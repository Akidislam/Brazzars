import { Router } from 'express';
import {
  approveProductController,
  listPendingProductsController,
  rejectProductController,
} from '../controllers/productController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';

const router = Router();
router.use(authenticate, authorizeRoles('admin'));
router.get('/pending', listPendingProductsController);
router.patch('/:id/approve', approveProductController);
router.patch('/:id/reject', rejectProductController);

export default router;
