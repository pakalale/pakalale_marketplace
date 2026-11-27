import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { buildQuote, distanceBetweenKm, estimateDistanceKm } from "@/lib/delivery/pricing";
import Shop from "@/models/Shop";

/**
 * Prices a delivery before checkout. One quote per shop because each shop has
 * its own pickup pin. The returned `quoteId` is signed and is required when the
 * order is placed, so the browser cannot decide its own delivery fee.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const shopIds: unknown[] = Array.isArray(body.shopIds) ? body.shopIds : [];
    const provider = body.provider;
    const address = typeof body.deliveryAddress === "string" ? body.deliveryAddress.trim() : "";
    const customerCoordinates =
      body.customerCoordinates && typeof body.customerCoordinates.lat === "number"
        ? { lat: body.customerCoordinates.lat, lng: body.customerCoordinates.lng }
        : undefined;

    if (provider !== "yango") {
      return NextResponse.json({ error: "Choose Yango or pick up from the shop" }, { status: 400 });
    }
    if (shopIds.length === 0 || shopIds.length > 20 || !shopIds.every((id) => mongoose.isValidObjectId(id))) {
      return NextResponse.json({ error: "Invalid shop list" }, { status: 400 });
    }
    if (!address) {
      return NextResponse.json({ error: "Add a delivery address to see the courier price" }, { status: 400 });
    }

    await connectToDatabase();
    const shops = await Shop.find({ _id: { $in: shopIds as string[] } })
      .select("name coordinates")
      .lean();

    const quotes = shops.map((shop) => {
      const id = shop._id.toString();
      const distanceKm =
        customerCoordinates && shop.coordinates?.lat && shop.coordinates?.lng
          ? distanceBetweenKm(shop.coordinates, customerCoordinates)
          : estimateDistanceKm(`${id}:${address.toLowerCase()}`);
      return buildQuote({ shopId: id, provider: "yango", distanceKm: Math.max(1, distanceKm), address });
    });

    return NextResponse.json({
      quotes,
      // The UI labels this so nobody mistakes a sandbox price for Yango's live one.
      placeholder: !process.env.YANGO_DELIVERY_TOKEN,
    });
  } catch (error) {
    console.error("Delivery quote error:", error);
    return NextResponse.json({ error: "Could not calculate the delivery price" }, { status: 500 });
  }
}
