import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  password?: string;
  googleId?: string;
  authProvider?: "email" | "google";
  firstName: string;
  lastName: string;
  avatar?: string;
  role: "customer" | "shop_owner" | "admin";
  isVerified: boolean;
  emailVerified?: boolean;
  emailVerificationTokenHash?: string;
  emailVerificationExpires?: Date;
  emailVerificationSentAt?: Date;
  location?: string;
  phone?: string;
  defaultAddress?: string;
  bio?: string;
  locationCoordinates?: { lat: number; lng: number };
  interestedCategories?: string[];
  lastActiveAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String },
    googleId: { type: String, select: false, unique: true, sparse: true },
    authProvider: { type: String, enum: ["email", "google"], default: "email" },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true, default: "" },
    avatar: { type: String },
    role: { type: String, enum: ["customer", "shop_owner", "admin"], default: "customer" },
    isVerified: { type: Boolean, default: false },
    emailVerified: { type: Boolean },
    emailVerificationTokenHash: { type: String, select: false, index: { sparse: true } },
    emailVerificationExpires: { type: Date, select: false },
    emailVerificationSentAt: { type: Date, select: false },
    location: { type: String },
    phone: { type: String },
    defaultAddress: { type: String, trim: true, maxlength: 500 },
    bio: { type: String },
    locationCoordinates: {
      lat: { type: Number },
      lng: { type: Number },
    },
    interestedCategories: [{ type: String }],
    lastActiveAt: { type: Date },
  },
  { timestamps: true }
);

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
export default User;
