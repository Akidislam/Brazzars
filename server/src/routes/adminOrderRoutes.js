import { Router } from 'express';
import {
  getAdminOrderController,
  getAdminOrderStatisticsController,
  listAdminOrdersController,
  updateAdminVendorOrderStatusController,
} from '../controllers/adminOrderController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';

const router = Router();
router.use(authenticate, authorizeRoles('admin'));
router.get('/statistics', getAdminOrderStatisticsController);
router.get('/', listAdminOrdersController);
router.get('/:id', getAdminOrderController);
router.patch('/vendor-orders/:vendorOrderId/status', updateAdminVendorOrderStatusController);

export default router;
