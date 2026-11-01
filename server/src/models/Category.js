import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required.'],
      trim: true,
      maxlength: 120,
    },
    slug: {
      type: String,
      required: [true, 'Category slug is required.'],
      trim: true,
      lowercase: true,
      match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and single hyphens in the slug.'],
      unique: true,
    },
    description: { type: String, trim: true, maxlength: 1000 },
    image: { type: String, trim: true, maxlength: 2048 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const Category = mongoose.models.Category || mongoose.model('Category', categorySchema);

export default Category;
