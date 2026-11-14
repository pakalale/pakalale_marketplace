import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { getSessionUser } from "@/lib/session";
import ProductView from "@/models/ProductView";
import Product from "@/models/Product";

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const body = await request.json();
    const { productId, source } = body;
    const viewer = await getSessionUser(request);

    if (!productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }

    // Record the view
    await ProductView.create({
      productId: new mongoose.Types.ObjectId(productId),
      // Attribute the view only to the signed-in viewer, never to a claimed id.
      userId: viewer ? new mongoose.Types.ObjectId(viewer.id) : undefined,
      source: source || "direct",
    });

    // Increment view count on the product
    await Product.findByIdAndUpdate(productId, { $inc: { views: 1 } });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Product View POST error:", error);
    return NextResponse.json({ error: "Failed to record view" }, { status: 500 });
  }
}
