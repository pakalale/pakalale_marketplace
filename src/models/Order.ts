import mongoose, { Schema, Document, Model } from "mongoose";

export interface IOrderItem {
  productId: mongoose.Types.ObjectId;
  quantity: number;
  price: number;
}

export type OrderStatus =
  | "order_placed"
  | "approved"
  | "agent_assigned"
  | "delivery_in_progress"
  | "delivered"
  | "completed"
  | "cancelled";

export type OrderDeliveryMethod = "yango" | "indrive" | "pickup";
export type OrderPaymentMethod = "airtel_money" | "cash";

/** Provider booking attached to a delivery order once the shop approves it. */
export interface IOrderDelivery {
  provider?: OrderDeliveryMethod;
  externalId?: string;
  quoteId?: string;
  stage?: string;
  fee?: number;
  distanceKm?: number;
  etaMinutes?: number;
  currency?: string;
  /** Public tracking page from the provider (the Yango app link). */
  trackingUrl?: string;
  pickup?: { lat: number; lng: number };
  dropoff?: { lat: number; lng: number };
  bookedAt?: Date;
  dispatchedAt?: Date;
  deliveredAt?: Date;
  cancelledAt?: Date;
  lastSyncedAt?: Date;
  /** True while the provider is the in-app sandbox courier. */
  mock?: boolean;
  error?: string;
}

/**
 * Escrow-style payment. Airtel Money orders are held at checkout and released
 * to the shop (minus the courier's fee) only when the customer confirms they
 * received the goods. Pickup orders are paid in cash at the shop.
 */
export type EscrowStatus = "held" | "released" | "refunded" | "cash" | "none";

export interface IOrderEscrow {
  status: EscrowStatus;
  amount: number;
  goodsAmount: number;
  deliveryFee: number;
  shopPayout?: number;
  courierPayout?: number;
  reference?: string;
  heldAt?: Date;
  releasedAt?: Date;
  refundedAt?: Date;
}

export interface IOrderDeliveryAgent {
  name?: string;
  phone?: string;
  vehicle?: string;
  plate?: string;
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
  delivery?: IOrderDelivery;
  escrow?: IOrderEscrow;
  /** Shared by the customer so the shop can see how far away they are. */
  customerLocation?: { lat: number; lng: number; updatedAt: Date };
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
        "agent_assigned",
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
      vehicle: { type: String, trim: true },
      plate: { type: String, trim: true },
      location: {
        lat: { type: Number },
        lng: { type: Number },
        updatedAt: { type: Date },
      },
      trackingToken: { type: String, index: true },
    },
    delivery: {
      provider: { type: String, enum: ["yango", "indrive", "pickup"] },
      externalId: { type: String },
      quoteId: { type: String },
      stage: { type: String },
      fee: { type: Number, min: 0 },
      distanceKm: { type: Number, min: 0 },
      etaMinutes: { type: Number, min: 0 },
      currency: { type: String },
      trackingUrl: { type: String },
      pickup: { lat: { type: Number }, lng: { type: Number } },
      dropoff: { lat: { type: Number }, lng: { type: Number } },
      bookedAt: { type: Date },
      dispatchedAt: { type: Date },
      deliveredAt: { type: Date },
      cancelledAt: { type: Date },
      lastSyncedAt: { type: Date },
      mock: { type: Boolean },
      error: { type: String },
    },
    escrow: {
      status: {
        type: String,
        enum: ["held", "released", "refunded", "cash", "none"],
        default: "none",
      },
      amount: { type: Number, min: 0, default: 0 },
      goodsAmount: { type: Number, min: 0, default: 0 },
      deliveryFee: { type: Number, min: 0, default: 0 },
      shopPayout: { type: Number, min: 0 },
      courierPayout: { type: Number, min: 0 },
      reference: { type: String },
      heldAt: { type: Date },
      releasedAt: { type: Date },
      refundedAt: { type: Date },
    },
    customerLocation: {
      lat: { type: Number },
      lng: { type: Number },
      updatedAt: { type: Date },
    },
    saleRecordedAt: { type: Date },
  },
  { timestamps: true }
);

const Order: Model<IOrder> =
  mongoose.models.Order || mongoose.model<IOrder>("Order", OrderSchema);
export default Order;
