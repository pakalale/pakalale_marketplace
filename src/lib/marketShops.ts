import mongoose from "mongoose";
import { Location } from "@/models/FeedPost";
import Shop from "@/models/Shop";

/**
 * Products do not store a market, only a shop. Shops store their market as an
 * id or a slug, so look the market up and return the ids of every shop in it.
 */
export async function shopIdsInMarket(market: string) {
  const locationQuery: Record<string, unknown>[] = [{ slug: market }];
  if (mongoose.isValidObjectId(market)) locationQuery.push({ _id: market });
  const location = await Location.findOne({ $or: locationQuery }).select("_id slug").lean();
  const keys = [market, location?._id?.toString(), location?.slug].filter(Boolean) as string[];
  const shops = await Shop.find({ locationId: { $in: keys } }).select("_id").lean();
  return shops.map((shop) => shop._id);
}
