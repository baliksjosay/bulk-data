import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SecurityAuditLog } from '../entities/security-auditlog.entity';
import { SecurityEventType } from 'src/modules/auth/enums/security-event-type.enum';

@Injectable()
export class SecurityAuditService {
  constructor(
    @InjectRepository(SecurityAuditLog)
    private readonly repo: Repository<SecurityAuditLog>,
  ) {}

  async log(input: {
    eventType: SecurityEventType;
    userId?: string | null;
    email?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    deviceId?: string | null;
    deviceType?: string | null;
    authMethod?: string | null;
    authProvider?: string | null;
    success: boolean;
    reason?: string | null;
    metadata?: Record<string, any> | null;
  }): Promise<void> {
    await this.repo.save(this.repo.create(input));
  }
}
