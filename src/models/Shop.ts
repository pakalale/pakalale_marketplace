import mongoose, { Schema, Document, Model } from "mongoose";

export interface IShop extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description: string;
  ownerId: mongoose.Types.ObjectId;
  locationId?: string;
  status: "pending" | "verified" | "rejected";
  contact: {
    phone: string;
    email: string;
    whatsapp?: string;
  };
  hours: {
    [key: string]: { open: string; close: string; closed: boolean };
  };
  coverImage?: string;
  profileImage?: string;
  images: string[];
  specialties: string[];
  rating?: number;
  totalReviews: number;
  totalViews: number;
  /** Completed orders, i.e. recorded sales. */
  totalSales?: number;
  /** Revenue from completed orders, in Kwacha. */
  totalRevenue?: number;
  coordinates?: { lat: number; lng: number };
  searchableCategories?: string[];
  responseRate?: number;
  avgResponseTime?: number;
  demandScore?: number;
  verificationDocuments?: {
    businessLicense?: string;
    taxCertificate?: string;
    nationalId?: string;
    other?: string[];
  };
  verificationNotes?: string;
  verifiedAt?: Date;
  rejectedReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ShopSchema = new Schema<IShop>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    locationId: { type: String },
    status: { type: String, enum: ["pending", "verified", "rejected"], default: "pending" },
    contact: {
      phone: { type: String, default: "" },
      email: { type: String, default: "" },
      whatsapp: { type: String },
    },
    hours: { type: Schema.Types.Mixed, default: {} },
    coverImage: { type: String },
    profileImage: { type: String },
    images: [{ type: String }],
    specialties: [{ type: String }],
    rating: { type: Number, min: 0, max: 5 },
    totalReviews: { type: Number, default: 0 },
    totalViews: { type: Number, default: 0 },
    totalSales: { type: Number, default: 0, min: 0 },
    totalRevenue: { type: Number, default: 0, min: 0 },
    coordinates: {
      lat: { type: Number },
      lng: { type: Number },
    },
    searchableCategories: [{ type: String }],
    responseRate: { type: Number, default: 0 },
    avgResponseTime: { type: Number, default: 0 },
    demandScore: { type: Number, default: 0 },
    verificationDocuments: {
      businessLicense: { type: String },
      taxCertificate: { type: String },
      nationalId: { type: String },
      other: [{ type: String }],
    },
    verificationNotes: { type: String },
    verifiedAt: { type: Date },
    rejectedReason: { type: String },
  },
  { timestamps: true }
);

const Shop: Model<IShop> = mongoose.models.Shop || mongoose.model<IShop>("Shop", ShopSchema);
export default Shop;
