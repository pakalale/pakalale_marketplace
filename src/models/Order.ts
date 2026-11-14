import mongoose, { Schema, Document, Model } from "mongoose";

export interface IOrderItem {
  productId: mongoose.Types.ObjectId;
  quantity: number;
  price: number;
}

export interface IOrder extends Document {
  _id: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  shopId: mongoose.Types.ObjectId;
  items: IOrderItem[];
  status: "pending" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled";
  /** Items only. Older orders have no subtotal: their total had no delivery. */
  subtotal?: number;
  /** subtotal + deliveryFee, charged by the server. */
  total: number;
  deliveryMethod?: string;
  deliveryFee?: number;
  deliveryAddress?: string;
  phone?: string;
  paymentMethod?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true },
});

const OrderSchema = new Schema<IOrder>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true },
    items: [OrderItemSchema],
    status: {
      type: String,
      enum: ["pending", "confirmed", "preparing", "ready", "completed", "cancelled"],
      default: "pending",
    },
    subtotal: { type: Number },
    total: { type: Number, required: true },
    deliveryMethod: { type: String },
    deliveryFee: { type: Number, default: 0 },
    deliveryAddress: { type: String },
    phone: { type: String },
    paymentMethod: { type: String, default: "Cash" },
    notes: { type: String },
  },
  { timestamps: true }
);

const Order: Model<IOrder> =
  mongoose.models.Order || mongoose.model<IOrder>("Order", OrderSchema);
export default Order;
