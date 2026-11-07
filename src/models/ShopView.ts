import mongoose, { Schema, Document, Model } from "mongoose";

export interface IShopView extends Document {
  _id: mongoose.Types.ObjectId;
  shopId: mongoose.Types.ObjectId;
  visitorId: mongoose.Types.ObjectId;
  lastViewedAt: Date;
}

const ShopViewSchema = new Schema<IShopView>(
  {
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true },
    visitorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    lastViewedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: false }
);

ShopViewSchema.index({ shopId: 1, visitorId: 1 }, { unique: true });
ShopViewSchema.index({ shopId: 1, lastViewedAt: -1 });

const ShopView: Model<IShopView> =
  mongoose.models.ShopView || mongoose.model<IShopView>("ShopView", ShopViewSchema);

export default ShopView;