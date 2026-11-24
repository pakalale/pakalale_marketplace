import mongoose, { Schema, Document, Model } from "mongoose";

export interface IOrderItem {
  productId: mongoose.Types.ObjectId;
  quantity: number;
  price: number;
}

export type OrderStatus =
  | "order_placed"
  | "approved"
  | "delivery_in_progress"
  | "delivered"
  | "completed"
  | "cancelled";

export type OrderDeliveryMethod = "yango" | "indrive" | "pickup";
export type OrderPaymentMethod = "airtel_money" | "cash";

export interface IOrderDeliveryAgent {
  name?: string;
  phone?: string;
  /** Last position shared from the agent's tracking link. */
  location?: {
    lat: number;
    lng: number;
    updatedAt: Date;
  };
  /** Secret in the agent's no-login tracking link (`/track/<token>`). */
  trackingToken?: string;
}

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
  deliveryAgent?: IOrderDeliveryAgent;
  /** Set once the completion step recorded the sale, so stock only drops once. */
  saleRecordedAt?: Date;
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
      // Old statuses are intentionally still allowed so pre-existing orders
      // can be read and normalised rather than failing validation.
      type: String,
      enum: [
        "order_placed",
        "approved",
        "delivery_in_progress",
        "delivered",
        "completed",
        "cancelled",
        "order_received",
        "in_store",
        "out_for_delivery",
        "ready_for_pickup",
        "received",
        "pending",
        "confirmed",
        "preparing",
        "ready",
      ],
      default: "order_placed",
    },
    total: { type: Number, required: true },
    subtotal: { type: Number },
    deliveryMethod: { type: String, enum: ["yango", "indrive", "pickup"] },
    deliveryFee: { type: Number, min: 0, default: 0 },
    customerPhone: { type: String, trim: true },
    deliveryAddress: { type: String, trim: true },
    paymentMethod: { type: String, default: "Cash" },
    notes: { type: String },
    deliveryAgent: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
      location: {
        lat: { type: Number },
        lng: { type: Number },
        updatedAt: { type: Date },
      },
      trackingToken: { type: String, index: true },
    },
    saleRecordedAt: { type: Date },
  },
  { timestamps: true }
);

const Order: Model<IOrder> =
  mongoose.models.Order || mongoose.model<IOrder>("Order", OrderSchema);
export default Order;
