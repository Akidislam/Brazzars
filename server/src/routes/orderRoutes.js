import { Router } from 'express';
import {
  getCustomerOrderController,
  listCustomerOrdersController,
  placeOrderController,
} from '../controllers/orderController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';

const router = Router();
router.use(authenticate, authorizeRoles('customer'));
router.post('/', placeOrderController);
router.get('/', listCustomerOrdersController);
router.get('/:id', getCustomerOrderController);

export default router;
