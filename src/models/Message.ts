import mongoose, { Schema, Document, Model } from "mongoose";

export interface IMessage extends Document {
  _id: mongoose.Types.ObjectId;
  chatId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  senderName: string;
  senderRole: "customer" | "shop_owner";
  content: string;
  type: "text" | "image" | "file" | "voice" | "system";
  isRead: boolean;
  readBy: mongoose.Types.ObjectId[];
  replyTo?: {
    messageId: mongoose.Types.ObjectId;
    content: string;
    senderName: string;
  };
  timestamp: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    chatId: { type: Schema.Types.ObjectId, ref: "Chat", required: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    senderName: { type: String, required: true },
    senderRole: { type: String, enum: ["customer", "shop_owner"], required: true },
    content: { type: String, required: true },
    type: { type: String, enum: ["text", "image", "file", "voice", "system"], default: "text" },
    isRead: { type: Boolean, default: false },
    readBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
    replyTo: {
      messageId: { type: Schema.Types.ObjectId },
      content: { type: String },
      senderName: { type: String },
    },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export interface IChat extends Document {
  _id: mongoose.Types.ObjectId;
  type: "general";
  participants: mongoose.Types.ObjectId[];
  lastMessage?: mongoose.Types.ObjectId;
  lastMessageTime: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ChatSchema = new Schema<IChat>(
  {
    type: { type: String, enum: ["general"], default: "general" },
    participants: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
    lastMessage: { type: Schema.Types.ObjectId, ref: "Message" },
    lastMessageTime: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Indexes for performance
MessageSchema.index({ chatId: 1, timestamp: 1 });
MessageSchema.index({ chatId: 1, senderId: 1, isRead: 1 });
ChatSchema.index({ participants: 1, isActive: 1, lastMessageTime: -1 });

const Message: Model<IMessage> =
  mongoose.models.Message || mongoose.model<IMessage>("Message", MessageSchema);
const Chat: Model<IChat> =
  mongoose.models.Chat || mongoose.model<IChat>("Chat", ChatSchema);

export { Message, Chat };
