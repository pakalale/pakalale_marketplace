import mongoose, { Schema, Document, Model } from "mongoose";

export interface IOrderItem {
  productId: mongoose.Types.ObjectId;
  quantity: number;
  price: number;
}

export type OrderStatus =
  | "order_received"
  | "in_store"
  | "out_for_delivery"
  | "ready_for_pickup"
  | "delivered"
  | "received"
  | "cancelled"
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "completed";

export type OrderDeliveryMethod = "yango" | "indrive" | "pickup";
export type OrderPaymentMethod = "airtel_money" | "cash";

export interface IOrder extends Document {
  _id: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  shopId: mongoose.Types.ObjectId;
  items: IOrderItem[];
  status: OrderStatus;
  total: number;
  subtotal?: number;
  deliveryMethod?: OrderDeliveryMethod;
  deliveryFee?: number;
  paymentMethod?: OrderPaymentMethod | string;
  customerPhone?: string;
  deliveryAddress?: string;
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
      enum: ["order_received", "in_store", "out_for_delivery", "ready_for_pickup", "delivered", "received", "cancelled", "pending", "confirmed", "preparing", "ready", "completed"],
      default: "order_received",
    },
    total: { type: Number, required: true },
    subtotal: { type: Number },
    deliveryMethod: { type: String, enum: ["yango", "indrive", "pickup"] },
    deliveryFee: { type: Number, min: 0, default: 0 },
    customerPhone: { type: String, trim: true },
    deliveryAddress: { type: String, trim: true },
    paymentMethod: { type: String, default: "Cash" },
    notes: { type: String },
  },
  { timestamps: true }
);

const Order: Model<IOrder> =
  mongoose.models.Order || mongoose.model<IOrder>("Order", OrderSchema);
export default Order;
