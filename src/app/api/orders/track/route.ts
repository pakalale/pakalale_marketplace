import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { createNotification } from "@/lib/notifications";
import { normalizeOrderStatus } from "@/lib/orderStatus";
import Order from "@/models/Order";
import Shop from "@/models/Shop";

/**
 * The delivery agent has no account in Pakalale, so the shop shares a tracking
 * link (`/track/<token>`) with them. The token is the only credential here: it
 * can read the delivery details of that one order, push its position and mark
 * the hand-off as delivered. It cannot touch anything else.
 */
const badToken = () => NextResponse.json({ error: "This tracking link is not valid" }, { status: 404 });

function validCoords(lat: unknown, lng: unknown) {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

async function findByToken(token: string) {
  if (!token || token.length < 16) return null;
  await connectToDatabase();
  return await Order.findOne({ "deliveryAgent.trackingToken": token })
    .select("shopId status deliveryMethod deliveryAddress customerPhone deliveryAgent delivery notes items")
    .lean();
}

export async function GET(request: NextRequest) {
  try {
    const token = new URL(request.url).searchParams.get("token") || "";
    const order = await findByToken(token);
    if (!order) return badToken();

    const shop = await Shop.findById(order.shopId).select("name locationId coordinates").lean();

    return NextResponse.json({
      order: {
        status: normalizeOrderStatus(order.status),
        deliveryMethod: order.deliveryMethod,
        deliveryAddress: order.deliveryAddress,
        customerPhone: order.customerPhone,
        notes: order.notes,
        items: order.items.length,
        shop: shop ? { name: shop.name, locationId: shop.locationId, coordinates: shop.coordinates } : null,
        delivery: {
          provider: order.delivery?.provider,
          stage: order.delivery?.stage,
          etaMinutes: order.delivery?.etaMinutes,
          dropoff: order.delivery?.dropoff,
          mock: order.delivery?.mock,
        },
        agent: {
          name: order.deliveryAgent?.name,
          phone: order.deliveryAgent?.phone,
          location: order.deliveryAgent?.location,
        },
      },
    });
  } catch (error) {
    console.error("Order tracking GET error:", error);
    return NextResponse.json({ error: "Could not load this delivery" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const token = typeof body.token === "string" ? body.token : "";
    const order = await findByToken(token);
    if (!order) return badToken();

    const status = normalizeOrderStatus(order.status);

    // The agent says the goods changed hands.
    if (body.action === "delivered") {
      if (status !== "delivery_in_progress") {
        return NextResponse.json({ error: "This order is not out for delivery" }, { status: 409 });
      }
      const updated = await Order.findOneAndUpdate(
        { "deliveryAgent.trackingToken": token, status: "delivery_in_progress" },
        { $set: { status: "delivered", "delivery.stage": "delivered", "delivery.deliveredAt": new Date() } },
        { new: true }
      )
        .select("customerId total")
        .lean();
      if (!updated) {
        return NextResponse.json({ error: "This order was already updated" }, { status: 409 });
      }

      const shop = await Shop.findById(order.shopId).select("name ownerId").lean();
      const orderRef = `#${order._id.toString().slice(-6).toUpperCase()}`;
      await Promise.all([
        createNotification({
          userId: updated.customerId.toString(),
          type: "order",
          title: `Order delivered ${orderRef}`,
          message: `Your order from ${shop?.name || "the shop"} has been delivered. Confirm you received it to complete the order.`,
          actionUrl: "/customer/orders",
          relatedId: order._id.toString(),
        }),
        shop?.ownerId
          ? createNotification({
              userId: shop.ownerId.toString(),
              type: "order",
              title: `Order delivered ${orderRef}`,
              message: "The delivery agent marked this order as delivered. Waiting for the customer to confirm.",
              actionUrl: "/shop/orders",
              relatedId: order._id.toString(),
            })
          : Promise.resolve(null),
      ]).catch((error) => console.error("Delivered notifications failed:", error));

      return NextResponse.json({ order: { status: "delivered" } });
    }

    if (!validCoords(body.lat, body.lng)) {
      return NextResponse.json({ error: "A valid location is required" }, { status: 400 });
    }
    // The rider may share while heading to the shop and on the way to the
    // customer; both screens watch the same position.
    if (!["agent_assigned", "delivery_in_progress"].includes(status)) {
      return NextResponse.json({ error: "This delivery is not active" }, { status: 409 });
    }

    await Order.updateOne(
      { _id: order._id },
      {
        $set: {
          "deliveryAgent.location": {
            lat: body.lat,
            lng: body.lng,
            updatedAt: new Date(),
          },
          "delivery.lastSyncedAt": new Date(),
        },
      }
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Order tracking PUT error:", error);
    return NextResponse.json({ error: "Could not update the delivery location" }, { status: 500 });
  }
}
