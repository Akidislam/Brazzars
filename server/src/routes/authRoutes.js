import { Router } from 'express';
import {
  currentUserController,
  changeAdminPasswordController,
  loginController,
  registerCustomerController,
  registerVendorController,
} from '../controllers/authController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

router.post('/register', registerCustomerController);
router.post('/register/vendor', registerVendorController);
router.post('/login', loginController);
router.get('/me', authenticate, currentUserController);
router.post('/change-password', authenticate, changeAdminPasswordController);

export default router;
