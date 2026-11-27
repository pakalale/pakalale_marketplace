import mongoose from "mongoose";
import Order from "@/models/Order";

/**
 * Escrow settlement.
 *
 * New Airtel Money orders are created with `escrow.status = "held"`. The money
 * only moves when the customer confirms they got the goods:
 *
 *   goods amount  → shop owner
 *   delivery fee  → delivery partner (Yango)
 *
 * Cash pickup orders carry `escrow.status = "cash"`; completing one only marks
 * the cash as collected. Both paths are idempotent, so a double confirm cannot
 * pay out twice.
 */

export interface Settlement {
  changed: boolean;
  status: "held" | "released" | "refunded" | "cash" | "none";
  amount: number;
  goodsAmount: number;
  deliveryFee: number;
  shopPayout: number;
  courierPayout: number;
  cash: boolean;
}

const EMPTY: Settlement = {
  changed: false,
  status: "none",
  amount: 0,
  goodsAmount: 0,
  deliveryFee: 0,
  shopPayout: 0,
  courierPayout: 0,
  cash: false,
};

export async function settleOrderPayment(orderId: mongoose.Types.ObjectId | string): Promise<Settlement> {
  const order = await Order.findById(orderId)
    .select("escrow subtotal deliveryFee total paymentMethod")
    .lean();
  if (!order?.escrow) return EMPTY;

  const { escrow } = order;
  if (escrow.status === "held") {
    const shopPayout = escrow.goodsAmount || order.subtotal || order.total;
    const courierPayout = escrow.deliveryFee || order.deliveryFee || 0;
    const claimed = await Order.findOneAndUpdate(
      { _id: order._id, "escrow.status": "held" },
      {
        $set: {
          "escrow.status": "released",
          "escrow.shopPayout": shopPayout,
          "escrow.courierPayout": courierPayout,
          "escrow.releasedAt": new Date(),
        },
      },
      { new: true }
    )
      .select("escrow")
      .lean();
    if (!claimed) return { ...EMPTY, status: "released" };
    return {
      changed: true,
      status: "released",
      amount: escrow.amount,
      goodsAmount: shopPayout,
      deliveryFee: courierPayout,
      shopPayout,
      courierPayout,
      cash: false,
    };
  }

  if (escrow.status === "cash") {
    const claimed = await Order.findOneAndUpdate(
      { _id: order._id, "escrow.status": "cash", "escrow.releasedAt": { $exists: false } },
      { $set: { "escrow.releasedAt": new Date() } },
      { new: true }
    )
      .select("escrow")
      .lean();
    return {
      changed: Boolean(claimed),
      status: "cash",
      amount: escrow.amount,
      goodsAmount: escrow.goodsAmount,
      deliveryFee: 0,
      shopPayout: escrow.goodsAmount,
      courierPayout: 0,
      cash: true,
    };
  }

  return {
    changed: false,
    status: escrow.status,
    amount: escrow.amount,
    goodsAmount: escrow.goodsAmount,
    deliveryFee: escrow.deliveryFee,
    shopPayout: escrow.shopPayout || 0,
    courierPayout: escrow.courierPayout || 0,
    cash: false,
  };
}

/** A cancelled order gives the customer their escrow back. */
export async function refundOrderPayment(orderId: mongoose.Types.ObjectId | string): Promise<boolean> {
  const order = await Order.findById(orderId).select("escrow").lean();
  if (!order?.escrow || order.escrow.status !== "held") return false;

  const claimed = await Order.findOneAndUpdate(
    { _id: order._id, "escrow.status": "held" },
    { $set: { "escrow.status": "refunded", "escrow.refundedAt": new Date() } },
    { new: true }
  )
    .select("_id")
    .lean();
  return Boolean(claimed);
}
