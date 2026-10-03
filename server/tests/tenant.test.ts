import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app';
import { Invitation } from '../src/models/Invitation';

const app = createApp();
let mongo: MongoMemoryServer;

const header = { 'x-teamflow-client': 'web' };

async function register(email: string, name: string) {
  const agent = request.agent(app);
  const response = await agent.post('/api/auth/register').set(header).send({
    name,
    email,
    password: 'password123',
  });
  expect(response.status).toBe(201);
  return agent;
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

describe('tenant isolation', () => {
  it('stops one organization from reading another organization task', async () => {
    const asha = await register('asha.tenant@example.com', 'Asha');
    const ravi = await register('ravi.tenant@example.com', 'Ravi');

    const orgA = await asha.post('/api/organizations').set(header).send({ name: 'Org A' });
    const orgB = await ravi.post('/api/organizations').set(header).send({ name: 'Org B' });
    expect(orgA.status).toBe(201);
    expect(orgB.status).toBe(201);

    const project = await asha
      .post('/api/projects')
      .set(header)
      .set('x-organization-id', orgA.body.data.id)
      .send({ name: 'Alpha' });
    expect(project.status).toBe(201);

    const task = await asha
      .post(`/api/projects/${project.body.data.id}/tasks`)
      .set(header)
      .set('x-organization-id', orgA.body.data.id)
      .send({ title: 'Secret task' });
    expect(task.status).toBe(201);

    const wrongOrg = await ravi
      .get(`/api/tasks/${task.body.data.id}`)
      .set('x-organization-id', orgB.body.data.id);
    expect(wrongOrg.status).toBe(404);

    const spoofedHeader = await ravi
      .get(`/api/tasks/${task.body.data.id}`)
      .set('x-organization-id', orgA.body.data.id);
    expect(spoofedHeader.status).toBe(403);

    const ownerRead = await asha
      .get(`/api/tasks/${task.body.data.id}`)
      .set('x-organization-id', orgA.body.data.id);
    expect(ownerRead.status).toBe(200);
    expect(ownerRead.body.data.title).toBe('Secret task');
  });

  it('blocks a viewer from creating tasks', async () => {
    const owner = await register('owner.viewer@example.com', 'Owner');
    const viewer = await register('viewer.role@example.com', 'Viewer');
    const org = await owner.post('/api/organizations').set(header).send({ name: 'Role Org' });
    const orgId = org.body.data.id;

    await owner
      .post('/api/invites')
      .set(header)
      .set('x-organization-id', orgId)
      .send({ email: 'viewer.role@example.com', role: 'VIEWER' });

    const invite = await Invitation.findOne({ email: 'viewer.role@example.com', status: 'pending' });
    expect(invite).toBeTruthy();

    // The raw token is not stored. Re-invite is hard, so accept by looking up the hash is not possible.
    // Create the membership the same way accept would, then prove the route still checks the role.
    const { OrganizationMember } = await import('../src/models/OrganizationMember');
    const { User } = await import('../src/models/User');
    const user = await User.findOne({ email: 'viewer.role@example.com' });
    await OrganizationMember.create({ organizationId: orgId, userId: user!._id, role: 'VIEWER' });

    const project = await owner
      .post('/api/projects')
      .set(header)
      .set('x-organization-id', orgId)
      .send({ name: 'Visible' });

    const { ProjectMember } = await import('../src/models/ProjectMember');
    await ProjectMember.create({ organizationId: orgId, projectId: project.body.data.id, userId: user!._id });

    const denied = await viewer
      .post(`/api/projects/${project.body.data.id}/tasks`)
      .set(header)
      .set('x-organization-id', orgId)
      .send({ title: 'Nope' });
    expect(denied.status).toBe(403);

    const listed = await viewer
      .get(`/api/projects/${project.body.data.id}/tasks`)
      .set('x-organization-id', orgId);
    expect(listed.status).toBe(200);
  });
});
