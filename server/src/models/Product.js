import mongoose from 'mongoose';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const productSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Vendor is required.'],
      index: true,
    },
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
      required: [true, 'Shop is required.'],
      index: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required.'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Product name is required.'],
      trim: true,
      maxlength: 180,
    },
    slug: {
      type: String,
      required: [true, 'Product slug is required.'],
      trim: true,
      lowercase: true,
      match: [slugPattern, 'Use lowercase letters, numbers, and single hyphens in the slug.'],
      maxlength: 180,
    },
    description: {
      type: String,
      required: [true, 'Product description is required.'],
      trim: true,
      maxlength: 10000,
    },
    price: {
      type: Number,
      required: [true, 'Product price is required.'],
      min: [0, 'Price cannot be negative.'],
      validate: { validator: Number.isFinite, message: 'Price must be a finite number.' },
    },
    compareAtPrice: {
      type: Number,
      min: [0, 'Compare-at price cannot be negative.'],
      validate: { validator: Number.isFinite, message: 'Compare-at price must be a finite number.' },
    },
    stock: {
      type: Number,
      required: [true, 'Stock quantity is required.'],
      min: [0, 'Stock cannot be negative.'],
      validate: [Number.isInteger, 'Stock must be a whole number.'],
    },
    images: {
      type: [{ type: String, trim: true, maxlength: 2048 }],
      default: [],
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'disabled'],
      default: 'pending',
      index: true,
    },
  },
  { timestamps: true },
);

productSchema.index({ shop: 1, slug: 1 }, { unique: true });
productSchema.index({ category: 1, status: 1 });
productSchema.index({ vendor: 1, status: 1 });

const Product = mongoose.models.Product || mongoose.model('Product', productSchema);

export default Product;
