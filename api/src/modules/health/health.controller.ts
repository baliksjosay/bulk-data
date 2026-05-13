import {
  Controller,
  Get,
  Query,
  HttpCode,
  HttpStatus,
  Header,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiProduces,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { HealthCheckService } from './health-check.service';
import { DatabasesHealthDto, SystemInfoDto } from './dto/health-response.dto';
import { Public } from 'src/common/decorators/public.decorator';

/**
 * Health Check Controller
 * Provides comprehensive health monitoring endpoints for the Wendi Commission Validation system
 */
@ApiTags('Health Check')
@Controller('health')
@Public()
@ApiBearerAuth()
export class HealthCheckController {
  constructor(private readonly healthCheckService: HealthCheckService) {}

  /**
   * Database health check endpoint
   * Returns status of all database connections
   */
  @Get('database')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  @ApiOperation({
    summary: 'Database health check',
    description:
      'Returns health status of all database connections including primary and source databases with connection details and response times.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Database health status retrieved successfully',
    type: DatabasesHealthDto,
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description: 'One or more databases are unavailable',
    schema: {
      type: 'object',
      properties: {
        primary: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'DOWN' },
            error: { type: 'string', example: 'Connection timeout' },
          },
        },
        source: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'UP' },
            responseTime: { type: 'number', example: 45 },
          },
        },
      },
    },
  })
  @ApiProduces('application/json')
  async getDatabaseHealth(): Promise<DatabasesHealthDto> {
    return this.healthCheckService.getDatabaseHealth();
  }

  /**
   * System information endpoint
   * Returns detailed system resource information
   */
  @Get('system')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  @ApiOperation({
    summary: 'System information',
    description:
      'Returns detailed system information including CPU usage, memory statistics, operating system details, and process information.',
  })
  @ApiQuery({
    name: 'includeMemoryDetails',
    required: false,
    description: 'Include detailed memory usage breakdown',
    type: Boolean,
    example: true,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'System information retrieved successfully',
    type: SystemInfoDto,
  })
  @ApiProduces('application/json')
  async getSystemInfo(
    @Query('includeMemoryDetails') includeMemoryDetails: boolean = true,
  ): Promise<SystemInfoDto> {
    const database = await this.healthCheckService.getDatabaseHealth();
    const system = await this.healthCheckService.getSystemInfo({
      includeMemoryDetails,
    });
    system.database = database;
    return system;
  }

  /**
   * Liveness probe endpoint
   * Kubernetes/Docker liveness probe endpoint
   */
  @Get('live')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  @ApiOperation({
    summary: 'Liveness probe',
    description:
      'Kubernetes/Docker liveness probe endpoint. Returns 200 if application process is alive, 503 if application should be restarted.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Application process is alive',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ALIVE' },
        timestamp: { type: 'string', example: '2024-07-15T14:30:00Z' },
        uptime: { type: 'number', example: 3600 },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description: 'Application process is not responding properly',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'NOT_ALIVE' },
        timestamp: { type: 'string', example: '2024-07-15T14:30:00Z' },
        reason: { type: 'string', example: 'Process unresponsive' },
      },
    },
  })
  @ApiProduces('application/json')
  async getLiveness(): Promise<any> {
    try {
      // Simple liveness check - if we can respond, we're alive
      return {
        status: 'ALIVE',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      };
    } catch (error) {
      return {
        status: 'NOT_ALIVE',
        timestamp: new Date().toISOString(),
        reason: error.message,
      };
    }
  }
}
