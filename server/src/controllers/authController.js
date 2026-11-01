import { login, registerCustomer, registerVendor } from '../services/authService.js';
import { toSafeUser } from '../utils/safeUser.js';

export async function registerCustomerController(req, res, next) {
  try {
    const result = await registerCustomer(req.body);
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
}

export async function registerVendorController(req, res, next) {
  try {
    const result = await registerVendor(req.body);
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
}

export async function loginController(req, res, next) {
  try {
    const result = await login(req.body);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
}

export function currentUserController(req, res) {
  return res.status(200).json({ success: true, data: { user: toSafeUser(req.user) } });
}
