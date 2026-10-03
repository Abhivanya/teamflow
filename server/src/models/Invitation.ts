import { Schema, model } from 'mongoose';
import { ROLES } from '../permissions/permissions';

const invitationSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, enum: ROLES, required: true },
    tokenHash: { type: String, required: true, unique: true },
    status: { type: String, enum: ['pending', 'accepted'], default: 'pending' },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

invitationSchema.index({ organizationId: 1, email: 1, status: 1 });

export const Invitation = model('Invitation', invitationSchema);
