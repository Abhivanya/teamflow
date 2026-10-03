import { Schema, model } from 'mongoose';

const emailTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['verify', 'reset'], required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

emailTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const EmailToken = model('EmailToken', emailTokenSchema);
