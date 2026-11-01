import { Router } from 'express';
import {
  currentUserController,
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

export default router;
