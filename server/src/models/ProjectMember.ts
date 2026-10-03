import { Schema, model } from 'mongoose';

const projectMemberSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

projectMemberSchema.index({ projectId: 1, userId: 1 }, { unique: true });
projectMemberSchema.index({ organizationId: 1, userId: 1 });

export const ProjectMember = model('ProjectMember', projectMemberSchema);
