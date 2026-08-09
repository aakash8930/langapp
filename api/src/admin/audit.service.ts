import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AdminAction, AdminActionDocument } from './schemas/admin-action.schema';

@Injectable()
export class AuditService {
  constructor(
    @InjectModel(AdminAction.name) private readonly model: Model<AdminActionDocument>,
  ) {}

  async log(params: {
    adminId: string;
    email: string;
    action: string;
    resource: string;
    resourceId?: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    await this.model.create({
      adminId: new Types.ObjectId(params.adminId),
      email: params.email,
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId ?? null,
      details: params.details ?? {},
    });
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    action?: string;
    adminId?: string;
  }) {
    const query: Record<string, unknown> = {};
    if (params.action) query.action = params.action;
    if (params.adminId && Types.ObjectId.isValid(params.adminId)) {
      query.adminId = new Types.ObjectId(params.adminId);
    }

    const page = params.page ?? 1;
    const limit = Math.min(100, params.limit ?? 50);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.model.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.model.countDocuments(query).exec(),
    ]);

    return { items, total, page };
  }
}
