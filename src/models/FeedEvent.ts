import mongoose, { Schema, Document, Model } from "mongoose";

export interface IFeedEvent extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  postId?: mongoose.Types.ObjectId;
  eventType: "view" | "click" | "like" | "comment" | "share";
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

const FeedEventSchema = new Schema<IFeedEvent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    postId: { type: Schema.Types.ObjectId, ref: "FeedPost" },
    eventType: { type: String, enum: ["view", "click", "like", "comment", "share"], required: true },
    metadata: { type: Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

FeedEventSchema.index({ postId: 1, eventType: 1 });
FeedEventSchema.index({ userId: 1, timestamp: -1 });
FeedEventSchema.index({ eventType: 1, timestamp: -1 });

const FeedEvent: Model<IFeedEvent> =
  mongoose.models.FeedEvent || mongoose.model<IFeedEvent>("FeedEvent", FeedEventSchema);
export default FeedEvent;
