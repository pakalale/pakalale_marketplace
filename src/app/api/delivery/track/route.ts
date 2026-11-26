import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { createNotification } from "@/lib/notifications";
import { getSessionUser } from "@/lib/session";
import { getDeliverySnapshot } from "@/lib/delivery";
import { routeFor } from "@/lib/delivery/booking";
import type { DeliverySnapshotInput } from "@/lib/delivery/types";
import { normalizeOrderStatus } from "@/lib/orderStatus";
import Order from "@/models/Order";
import Shop from "@/models/Shop";

const PROVIDER_STATUSES: DeliverySnapshotInput["status"][] = [
  "approved",
  "agent_assigned",
  "delivery_in_progress",
  "delivered",
  "completed",
  "cancelled",
];

/**
 * The customer's and shop's window into a delivery.
 *
 * Every poll asks the provider for the latest stage and courier position. With
 * no Yango token configured the provider mock advances the courier along the
 * route, which keeps both screens moving while the integration is pending. When
 * the provider reports the trip complete the order moves to `delivered`; the
 * customer still has to confirm receipt before escrow is released.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionUser(request);
    if (!session) return NextResponse.json({ error: "Please sign in" }, { status: 401 });

    const orderId = new URL(request.url).searchParams.get("orderId");
    if (!orderId || !mongoose.isValidObjectId(orderId)) {
      return NextResponse.json({ error: "Invalid order" }, { status: 400 });
    }

    await connectToDatabase();
    const order = await Order.findById(orderId)
      .select("shopId customerId status deliveryMethod delivery deliveryAgent")
      .lean();
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const shop = await Shop.findById(order.shopId).select("name ownerId coordinates").lean();
    const isCustomer = order.customerId.toString() === session.id;
    const isShopOwner = shop?.ownerId?.toString() === session.id;
    if (session.role !== "admin" && !isCustomer && !isShopOwner) {
      return NextResponse.json({ error: "You cannot track this delivery" }, { status: 403 });
    }
    if (order.deliveryMethod === "pickup") {
      return NextResponse.json({ error: "Pickup orders have no courier" }, { status: 400 });
    }

    const status = normalizeOrderStatus(order.status);
    const providerStatus: DeliverySnapshotInput["status"] = PROVIDER_STATUSES.includes(
      status as DeliverySnapshotInput["status"]
    )
      ? (status as DeliverySnapshotInput["status"])
      : "approved";

    const { pickup, dropoff } = routeFor({
      id: order._id.toString(),
      provider: order.deliveryMethod === "indrive" ? "indrive" : "yango",
      shopName: shop?.name || "Shop",
      customerName: "Customer",
      customerPhone: order.deliveryAddress || "",
      pickup: order.delivery?.pickup,
      dropoff: order.delivery?.dropoff,
      distanceKm: order.delivery?.distanceKm,
    });

    const snapshot = await getDeliverySnapshot({
      orderId: order._id.toString(),
      status: providerStatus,
      externalId: order.delivery?.externalId,
      bookedAt: order.delivery?.bookedAt,
      dispatchedAt: order.delivery?.dispatchedAt,
      pickup,
      dropoff,
    });

    const set: Record<string, unknown> = {
      "delivery.stage": snapshot.stage,
      "delivery.lastSyncedAt": new Date(),
    };
    if (snapshot.location) {
      set["deliveryAgent.location"] = {
        lat: snapshot.location.lat,
        lng: snapshot.location.lng,
        updatedAt: new Date(snapshot.location.updatedAt),
      };
    }
    if (typeof snapshot.etaMinutes === "number") set["delivery.etaMinutes"] = snapshot.etaMinutes;
    if (snapshot.trackingUrl) set["delivery.trackingUrl"] = snapshot.trackingUrl;

    let nextStatus = status;
    if (snapshot.stage === "delivered" && status === "delivery_in_progress") {
      // Atomic guard: a shop marking it delivered at the same moment must not
      // produce two notifications.
      const delivered = await Order.findOneAndUpdate(
        { _id: order._id, status: "delivery_in_progress" },
        { $set: { ...set, status: "delivered", "delivery.deliveredAt": new Date() } },
        { new: true }
      )
        .select("_id")
        .lean();
      if (delivered) {
        nextStatus = "delivered";
        const orderRef = `#${order._id.toString().slice(-6).toUpperCase()}`;
        await Promise.all([
          createNotification({
            userId: order.customerId.toString(),
            type: "order",
            title: `Order delivered ${orderRef}`,
            message: `${shop?.name || "The shop"} handed your parcel to the courier and the trip is complete. Confirm you received it to close the order.`,
            actionUrl: "/customer/orders",
            relatedId: order._id.toString(),
          }),
          shop?.ownerId
            ? createNotification({
                userId: shop.ownerId.toString(),
                type: "order",
                title: `Order delivered ${orderRef}`,
                message: "The courier completed this trip. Waiting for the customer to confirm receipt.",
                actionUrl: "/shop/orders",
                relatedId: order._id.toString(),
              })
            : Promise.resolve(null),
        ]).catch((error) => console.error("Delivered notifications failed:", error));
      }
    } else {
      await Order.updateOne({ _id: order._id }, { $set: set });
    }

    return NextResponse.json({
      tracking: {
        orderId: order._id.toString(),
        status: nextStatus,
        provider: order.delivery?.provider || "yango",
        stage: snapshot.stage,
        mock: snapshot.mock,
        etaMinutes: snapshot.etaMinutes ?? order.delivery?.etaMinutes,
        trackingUrl: snapshot.trackingUrl || order.delivery?.trackingUrl,
        location: snapshot.location || order.deliveryAgent?.location,
        agent: {
          name: order.deliveryAgent?.name,
          phone: order.deliveryAgent?.phone,
          vehicle: order.deliveryAgent?.vehicle,
          plate: order.deliveryAgent?.plate,
        },
        pickup,
        dropoff,
        bookedAt: order.delivery?.bookedAt,
        dispatchedAt: order.delivery?.dispatchedAt,
      },
    });
  } catch (error) {
    console.error("Delivery tracking error:", error);
    return NextResponse.json({ error: "Could not refresh the courier position" }, { status: 500 });
  }
}
