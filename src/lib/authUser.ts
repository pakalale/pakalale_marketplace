import type { IUser } from "@/models/User";

/** The user object the browser keeps after signing in. Never includes secrets. */
export function toClientUser(user: Pick<IUser, "_id" | "email" | "firstName" | "lastName" | "role" | "isVerified" | "location" | "phone" | "bio" | "avatar" | "createdAt" | "updatedAt">) {
  return {
    id: user._id.toString(),
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isVerified: user.isVerified,
    location: user.location,
    phone: user.phone,
    bio: user.bio,
    avatar: user.avatar,
    createdAt: user.createdAt?.toISOString?.() || "",
    updatedAt: user.updatedAt?.toISOString?.() || "",
  };
}
