import { Schema, model, type Types } from 'mongoose';

const websiteSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    url:    { type: String, required: true, trim: true },
    name:   { type: String, trim: true, default: '' },
  },
  { timestamps: true },
);

websiteSchema.index({ userId: 1, url: 1 }, { unique: true });

export interface IWebsite {
  _id:    Types.ObjectId;
  userId: Types.ObjectId;
  url:    string;
  name:   string;
}

export const Website = model<IWebsite>('Website', websiteSchema);
