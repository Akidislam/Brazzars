import { Router } from 'express';
import {
  approveAdminVendorController,
  getAdminVendorController,
  listAdminVendorsController,
  rejectAdminVendorController,
  setAdminVendorStatusController,
} from '../controllers/adminVendorController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';

const router = Router();
router.use(authenticate, authorizeRoles('admin'));
router.get('/', listAdminVendorsController);
router.get('/:id', getAdminVendorController);
router.patch('/:id/approve', approveAdminVendorController);
router.patch('/:id/reject', rejectAdminVendorController);
router.patch('/:id/status', setAdminVendorStatusController);

export default router;
