import { Router } from 'express';
import {
  getVendorOrderController,
  getVendorOrderStatisticsController,
  listVendorOrdersController,
  updateVendorOrderStatusController,
} from '../controllers/orderController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';

const router = Router();
router.use(authenticate, authorizeRoles('vendor'));
router.get('/statistics', getVendorOrderStatisticsController);
router.get('/', listVendorOrdersController);
router.patch('/:id/status', updateVendorOrderStatusController);
router.get('/:id', getVendorOrderController);

export default router;
