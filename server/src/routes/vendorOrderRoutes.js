import { Router } from 'express';
import { getVendorOrderController, listVendorOrdersController } from '../controllers/orderController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';

const router = Router();
router.use(authenticate, authorizeRoles('vendor'));
router.get('/', listVendorOrdersController);
router.get('/:id', getVendorOrderController);

export default router;
