import { Module } from '@nestjs/common';
import { HealthCheckService } from './health-check.service';
import { HealthCheckController } from './health.controller';

/**
 * Health Check Module
 *
 * Provides comprehensive health monitoring capabilities including:
 * - Basic and detailed health checks
 * - Database connection monitoring
 * - System resource monitoring
 * - Kubernetes probe endpoints
 * - External service health checks
 */
@Module({
  controllers: [HealthCheckController],
  providers: [HealthCheckService],
  exports: [HealthCheckService],
})
export class HealthModule {}
