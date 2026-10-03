import { Schema, model } from 'mongoose';
import { ROLES } from '../permissions/permissions';

const organizationMemberSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ROLES, required: true },
  },
  { timestamps: true },
);

organizationMemberSchema.index({ userId: 1 });
organizationMemberSchema.index({ organizationId: 1, userId: 1 }, { unique: true });

export const OrganizationMember = model('OrganizationMember', organizationMemberSchema);
