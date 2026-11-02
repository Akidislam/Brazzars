import { Router } from 'express';
import {
  createAdminCategoryController,
  getAdminCategoryController,
  listAdminCategoriesController,
  setAdminCategoryActiveController,
  updateAdminCategoryController,
} from '../controllers/adminCategoryController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';

const router = Router();
router.use(authenticate, authorizeRoles('admin'));
router.get('/', listAdminCategoriesController);
router.post('/', createAdminCategoryController);
router.get('/:id', getAdminCategoryController);
router.patch('/:id', updateAdminCategoryController);
router.patch('/:id/status', setAdminCategoryActiveController);

export default router;
