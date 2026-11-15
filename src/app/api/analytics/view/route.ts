import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import ProductView from "@/models/ProductView";
import Product from "@/models/Product";

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const body = await request.json();
    const { productId, userId, source } = body;

    if (!productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }

    // Record the view
    await ProductView.create({
      productId: new mongoose.Types.ObjectId(productId),
      userId: userId ? new mongoose.Types.ObjectId(userId) : undefined,
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
