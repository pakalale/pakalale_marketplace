import mongoose, { Schema, Document, Model } from "mongoose";

export interface INewsletterSubscriber extends Document {
  email: string;
  createdAt: Date;
}

const NewsletterSubscriberSchema = new Schema<INewsletterSubscriber>(
  { email: { type: String, required: true, unique: true, lowercase: true, trim: true } },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const NewsletterSubscriber: Model<INewsletterSubscriber> =
  mongoose.models.NewsletterSubscriber ||
  mongoose.model<INewsletterSubscriber>("NewsletterSubscriber", NewsletterSubscriberSchema);

export default NewsletterSubscriber;
