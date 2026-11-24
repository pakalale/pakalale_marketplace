import mongoose, { Schema, Document, Model } from "mongoose";

export interface IReview extends Document {
  _id: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  shopId: mongoose.Types.ObjectId;
  productId?: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId;
  rating: number; // 1-5
  comment?: string;
  createdAt: Date;
}

const ReviewSchema = new Schema<IReview>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product" },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String },
  },
  { timestamps: true }
);

// Prevent duplicate reviews for the same order
ReviewSchema.index({ orderId: 1 }, { unique: true });
ReviewSchema.index({ shopId: 1, createdAt: -1 });
ReviewSchema.index({ customerId: 1, createdAt: -1 });

const Review: Model<IReview> =
  mongoose.models.Review || mongoose.model<IReview>("Review", ReviewSchema);

export default Review;
