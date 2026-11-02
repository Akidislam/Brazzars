import User from '../models/User.js';

const INITIAL_ADMIN_EMAIL = 'admin@gmail.com';
const INITIAL_ADMIN_PASSWORD = 'admin1234';

/** Creates the initial Admin only when explicitly invoked by the provisioning script. */
export async function provisionInitialAdmin({ UserModel = User } = {}) {
  const existing = await UserModel.findOne({ email: INITIAL_ADMIN_EMAIL });
  if (existing) {
    const error = new Error('Provisioning refused: an account already uses the initial Admin email. No account was changed.');
    error.code = 'ADMIN_EMAIL_EXISTS';
    throw error;
  }

  const admin = new UserModel({
    name: 'Brazzars Administrator',
    email: INITIAL_ADMIN_EMAIL,
    password: INITIAL_ADMIN_PASSWORD,
    role: 'admin',
    isActive: true,
    mustChangePassword: true,
  });

  try {
    await admin.save();
  } catch (error) {
    if (error?.code === 11000) {
      const duplicate = new Error('Provisioning refused: an account already uses the initial Admin email. No account was changed.');
      duplicate.code = 'ADMIN_EMAIL_EXISTS';
      throw duplicate;
    }
    throw error;
  }

  return { id: String(admin._id ?? admin.id), email: INITIAL_ADMIN_EMAIL };
}
