import mongoose from 'mongoose';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required.'],
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: [true, 'Email is required.'],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: [EMAIL_PATTERN, 'Enter a valid email address.'],
    },
    password: {
      type: String,
      required: [true, 'Password is required.'],
      minlength: [8, 'Password must be at least 8 characters.'],
      maxlength: [128, 'Password must be no more than 128 characters.'],
      select: false,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 30,
    },
    role: {
      type: String,
      enum: ['customer', 'vendor', 'admin'],
      default: 'customer',
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    mustChangePassword: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

// Hash on document saves so a password supplied during account creation is never persisted as plain text.
userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;

  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scrypt(this.password, salt, 64);
  this.password = `scrypt$16384$8$1$${salt}$${Buffer.from(derivedKey).toString('hex')}`;
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;
