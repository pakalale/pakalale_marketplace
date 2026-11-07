/**
 * Ensure all MongoDB indexes exist for optimal performance.
 * Run with: npx tsx scripts/ensure-indexes.ts
 */
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/pakalale";

async function ensureIndexes() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI);
  console.log("Connected.\n");

  const db = mongoose.connection.db!;

  // ── Users ──
  console.log("Users collection indexes:");
  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  console.log("  ✓ email (unique)");

  // ── Shops ──
  console.log("\nShops collection indexes:");
  await db.collection("shops").createIndex({ ownerId: 1 });
  console.log("  ✓ ownerId");
  await db.collection("shops").createIndex({ locationId: 1, rating: -1 });
  console.log("  ✓ locationId + rating");
  await db.collection("shops").createIndex({ name: "text", description: "text", specialties: "text" });
  console.log("  ✓ text index (name, description, specialties)");

  // ── Products ──
  console.log("\nProducts collection indexes:");
  await db.collection("products").createIndex({ name: "text", description: "text", tags: "text", category: "text", brand: "text" });
  console.log("  ✓ text index");
  await db.collection("products").createIndex({ shopId: 1, isAvailable: 1 });
  console.log("  ✓ shopId + isAvailable");
  await db.collection("products").createIndex({ category: 1, isAvailable: 1 });
  console.log("  ✓ category + isAvailable");
  await db.collection("products").createIndex({ price: 1 });
  console.log("  ✓ price");
  await db.collection("products").createIndex({ demandScore: -1 });
  console.log("  ✓ demandScore");

  // ── FeedPost ──
  console.log("\nFeedPost collection indexes:");
  await db.collection("feedposts").createIndex({ createdAt: -1 });
  console.log("  ✓ createdAt");
  await db.collection("feedposts").createIndex({ authorId: 1, createdAt: -1 });
  console.log("  ✓ authorId + createdAt");
  await db.collection("feedposts").createIndex({ postType: 1, createdAt: -1 });
  console.log("  ✓ postType + createdAt");
  await db.collection("feedposts").createIndex({ locationId: 1, createdAt: -1 });
  console.log("  ✓ locationId + createdAt");
  await db.collection("feedposts").createIndex({ isPromotion: 1, createdAt: -1 });
  console.log("  ✓ isPromotion + createdAt");
  await db.collection("feedposts").createIndex({ rankScore: -1 });
  console.log("  ✓ rankScore");

  // ── ShopView ──
  console.log("\nShopView collection indexes:");
  await db.collection("shopviews").createIndex({ shopId: 1, visitorId: 1 }, { unique: true });
  console.log("  ✓ shopId + visitorId (unique)");
  await db.collection("shopviews").createIndex({ shopId: 1, lastViewedAt: -1 });
  console.log("  ✓ shopId + lastViewedAt");

  // ── Messages ──
  console.log("\nMessages collection indexes:");
  await db.collection("messages").createIndex({ chatId: 1, timestamp: 1 });
  console.log("  ✓ chatId + timestamp");
  await db.collection("messages").createIndex({ chatId: 1, senderId: 1, isRead: 1 });
  console.log("  ✓ chatId + senderId + isRead");

  // ── Chats ──
  console.log("\nChats collection indexes:");
  await db.collection("chats").createIndex({ participants: 1, isActive: 1, lastMessageTime: -1 });
  console.log("  ✓ participants + isActive + lastMessageTime");

  // ── Notifications ──
  console.log("\nNotifications collection indexes:");
  await db.collection("notifications").createIndex({ userId: 1, createdAt: -1 });
  console.log("  ✓ userId + createdAt");
  await db.collection("notifications").createIndex({ userId: 1, isRead: 1 });
  console.log("  ✓ userId + isRead");

  // ── Locations ──
  console.log("\nLocations collection indexes:");
  await db.collection("locations").createIndex({ coordinates: "2dsphere" });
  console.log("  ✓ coordinates (2dsphere)");
  await db.collection("locations").createIndex({ slug: 1 }, { unique: true });
  console.log("  ✓ slug (unique)");

  // ── SearchHistory ──
  console.log("\nSearchHistory collection indexes:");
  await db.collection("searchhistories").createIndex({ userId: 1, createdAt: -1 });
  console.log("  ✓ userId + createdAt");

  console.log("\n✅ All indexes ensured.");
  await mongoose.disconnect();
}

ensureIndexes().catch((e) => {
  console.error("Failed:", e);
  process.exit(1);
});
