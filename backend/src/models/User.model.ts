import { Schema, model } from 'mongoose';

const userSchema = new Schema(
  {
    name:     { type: String, required: true, trim: true },
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String },
    picture:  { type: String, default: '' },
    provider: { type: String, enum: ['email', 'google'], default: 'email' },
  },
  { timestamps: true },
);

export const User = model('User', userSchema);
