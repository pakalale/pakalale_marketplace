import mongoose, { Schema, Document, Model } from "mongoose";

export interface IProduct extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  images: string[];
  category: string;
  stock: number;
  isAvailable: boolean;
  shopId: mongoose.Types.ObjectId;
  views: number;
  rating: number;
  reviews: number;
  tags: string[];
  brand?: string;
  color?: string;
  attributes?: Record<string, string>;
  demandScore?: number;
  /** Units sold through completed orders. */
  soldCount?: number;
  lastSoldAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    originalPrice: { type: Number },
    discount: { type: Number },
    images: [{ type: String }],
    category: { type: String, required: true },
    stock: { type: Number, default: 0, min: 0 },
    isAvailable: { type: Boolean, default: true },
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true },
    views: { type: Number, default: 0 },
    rating: { type: Number, default: 5, min: 0, max: 5 },
    reviews: { type: Number, default: 0 },
    tags: [{ type: String }],
    brand: { type: String },
    color: { type: String },
    attributes: { type: Schema.Types.Mixed },
    demandScore: { type: Number, default: 0 },
    soldCount: { type: Number, default: 0, min: 0 },
    lastSoldAt: { type: Date },
  },
  { timestamps: true }
);

ProductSchema.index({ name: "text", description: "text", tags: "text", category: "text", brand: "text" });
ProductSchema.index({ category: 1, isAvailable: 1 });
ProductSchema.index({ shopId: 1, isAvailable: 1 });
ProductSchema.index({ price: 1 });
ProductSchema.index({ demandScore: -1 });

const Product: Model<IProduct> =
  mongoose.models.Product || mongoose.model<IProduct>("Product", ProductSchema);
export default Product;
