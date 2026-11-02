import { connectDatabase } from '../src/config/database.js';
import { provisionInitialAdmin } from '../src/services/adminProvisioningService.js';
import mongoose from 'mongoose';

if (!process.argv.includes('--confirm')) {
  console.error('Admin provisioning was not run. Review the setup, then use: npm run provision:admin -- --confirm');
  process.exitCode = 1;
} else {
  try {
    await connectDatabase();
    await provisionInitialAdmin();
    console.info('Initial Admin account provisioned. Sign in and change the initial password immediately.');
  } catch (error) {
    if (error?.code === 'ADMIN_EMAIL_EXISTS') {
      console.error(error.message);
    } else {
      console.error('Admin provisioning failed. Check the database configuration and connection, then try again.');
    }
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}
