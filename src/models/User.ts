import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  /** Missing for accounts that only sign in with Google. */
  password?: string;
  googleId?: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  role: "customer" | "shop_owner" | "admin";
  isVerified: boolean;
  /** Undefined for accounts created before email verification existed. */
  emailVerified?: boolean;
  emailVerificationTokenHash?: string;
  emailVerificationExpires?: Date;
  emailVerificationSentAt?: Date;
  passwordResetTokenHash?: string;
  passwordResetExpires?: Date;
  passwordResetSentAt?: Date;
  passwordChangedAt?: Date;
  location?: string;
  phone?: string;
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
    googleId: { type: String, select: false },
    firstName: { type: String, required: true, trim: true },
    // Optional because some Google profiles have no family name.
    lastName: { type: String, trim: true, default: "" },
    avatar: { type: String },
    role: { type: String, enum: ["customer", "shop_owner", "admin"], default: "customer" },
    isVerified: { type: Boolean, default: false },
    // No default: older accounts stay undefined and are treated as verified.
    emailVerified: { type: Boolean },
    emailVerificationTokenHash: { type: String, select: false, index: { sparse: true } },
    emailVerificationExpires: { type: Date, select: false },
    emailVerificationSentAt: { type: Date, select: false },
    passwordResetTokenHash: { type: String, select: false, index: { sparse: true } },
    passwordResetExpires: { type: Date, select: false },
    passwordResetSentAt: { type: Date, select: false },
    passwordChangedAt: { type: Date },
    location: { type: String },
    phone: { type: String },
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
