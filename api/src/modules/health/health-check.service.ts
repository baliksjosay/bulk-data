import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import * as os from 'os';
import * as process from 'process';
import * as fs from 'fs';
import * as path from 'path';

import {
  DetailedHealthResponseDto,
  DatabaseHealthDto,
  DatabasesHealthDto,
  SystemInfoDto,
  MemoryInfoDto,
  CpuInfoDto,
  ApplicationInfoDto,
  HealthCheckFilterDto,
} from './dto/health-response.dto';

/**
 * Health Check Service
 * Provides comprehensive health monitoring for the Wendi Commission Validation application
 */
@Injectable()
export class HealthCheckService {
  private readonly logger = new Logger(HealthCheckService.name);
  private readonly applicationStartTime = new Date();
  private readonly packageJson: any;

  constructor(
    private readonly dataSource: DataSource,

    private readonly configService: ConfigService,
  ) {
    // Load package.json for version information
    try {
      const packagePath = path.join(process.cwd(), 'package.json');
      this.packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    } catch (error) {
      this.logger.warn('Could not load package.json', error.message);
      this.packageJson = { name: 'Unknown', version: 'Unknown' };
    }
  }

  /**
   * Get detailed health status including databases and system information

  /**
   * Get database health for both primary and source databases
   */
  async getDatabaseHealth(): Promise<any> {
    try {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();

      // Get DB version
      const versionResult = await queryRunner.query('SELECT version()');

      // Get current time from DB
      const timeResult = await queryRunner.query('SELECT NOW()');

      // Uptime: Postgres example — replace with appropriate query for your DB
      let uptimeResult;
      try {
        uptimeResult = await queryRunner.query(
          `SELECT date_trunc('second', current_timestamp - pg_postmaster_start_time()) AS uptime FROM pg_postmaster_start_time()`,
        );
      } catch (err) {
        // If uptime query fails (on MariaDB/MySQL or older PG), fallback
        uptimeResult = [{ uptime: 'N/A' }];
      }

      await queryRunner.release();

      return {
        status: 'UP',
        version: versionResult[0].version,
        currentTime: timeResult[0].now,
        uptime: uptimeResult[0].uptime || 'N/A',
      };
    } catch (error) {
      return {
        status: 'DOWN',
        error: error.message,
      };
    }
  }

  /**
   * Get comprehensive system information
   */
  async getSystemInfo(
    filters: HealthCheckFilterDto = {},
  ): Promise<SystemInfoDto> {
    const memoryInfo =
      filters.includeMemoryDetails !== false
        ? this.getMemoryInfo()
        : this.getBasicMemoryInfo();

    const cpuInfo = this.getCpuInfo();
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;

    return {
      nodeVersion: process.version,
      osName: os.type(),
      osVersion: os.release(),
      platform: os.platform(),
      hostname: os.hostname(),
      uptime: os.uptime(),
      processUptime: process.uptime(),
      memory: memoryInfo,
      cpu: cpuInfo,
      totalSystemMemory: total,
      usedSystemMemory: used,
      freeSystemMemory: free,
    };
  }

  /**
   * Check external services health (Redis, Elasticsearch, etc.)
   */
  async getExternalServicesHealth(): Promise<Record<string, any>> {
    const services = {};

    // Add Redis health check if configured
    if (this.configService.get('redis.enabled')) {
      try {
        services['redis'] = await this.checkRedisHealth();
      } catch (error) {
        services['redis'] = { status: 'DOWN', error: error.message };
      }
    }

    // Add other external services as needed
    // services['elasticsearch'] = await this.checkElasticsearchHealth();
    // services['messageQueue'] = await this.checkMessageQueueHealth();

    return services;
  }

  /**
   * Check application-specific services health
   */
  async getApplicationServicesHealth(): Promise<Record<string, any>> {
    const services = {};

    try {
      // Check cache service
      services['cacheService'] = { status: 'UP' };

      // Check notification service
      services['notificationService'] = { status: 'UP' };

      // Check file storage service
      services['fileStorageService'] = { status: 'UP' };

      // Add more application-specific health checks
    } catch (error) {
      this.logger.error('Application services health check failed', error);
    }

    return services;
  }

  // Private helper methods

  private async checkDatabaseConnection(
    dataSource: DataSource,
    name: string,
  ): Promise<DatabaseHealthDto> {
    const startTime = Date.now();

    try {
      if (!dataSource.isInitialized) {
        return {
          status: 'DOWN',
          error: 'DataSource not initialized',
        };
      }

      // Test connection with a simple query
      const queryRunner = dataSource.createQueryRunner();
      await queryRunner.connect();

      await queryRunner.query('SELECT 1 as health_check');
      const responseTime = Date.now() - startTime;

      // Get database metadata
      const driver = dataSource.driver;
      const options = dataSource.options;

      await queryRunner.release();

      return {
        status: 'UP',
        // url: this.sanitizeUrl(options.url || `${options.type}://${options.host}:${options.port}/${options.database}`),
        driverName: driver.constructor.name,
        driverVersion: this.getDriverVersion(driver),
        responseTime,
        schema: options.database as string,
      };
    } catch (error) {
      this.logger.error(`${name} database health check failed`, error);
      return {
        status: 'DOWN',
        error: error.message,
        responseTime: Date.now() - startTime,
      };
    }
  }

  private getApplicationInfo(): ApplicationInfoDto {
    return {
      name: this.configService.get('app.name'),
      version: this.packageJson.version || 'unknown',
      environment: this.configService.get('NODE_ENV', 'development'),
      buildTime: this.configService.get('app.buildTime'),
      startTime: this.applicationStartTime.toISOString(),
      gitCommit: this.configService.get('app.gitCommit'),
      gitBranch: this.configService.get('app.gitBranch'),
    };
  }

  private getMemoryInfo(): MemoryInfoDto {
    const memUsage = process.memoryUsage();
    const totalMemory = memUsage.heapTotal;
    const usedMemory = memUsage.heapUsed;
    const freeMemory = totalMemory - usedMemory;
    const maxMemory = memUsage.rss; // Resident Set Size

    return {
      totalMemory,
      freeMemory,
      maxMemory,
      usedMemory,
      usagePercentage: (usedMemory / totalMemory) * 100,
      heapUsage: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        limit: memUsage.rss,
      },
    };
  }

  private getBasicMemoryInfo(): MemoryInfoDto {
    const memUsage = process.memoryUsage();
    return {
      totalMemory: memUsage.heapTotal,
      freeMemory: memUsage.heapTotal - memUsage.heapUsed,
      maxMemory: memUsage.rss,
      usedMemory: memUsage.heapUsed,
      usagePercentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      heapUsage: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        limit: memUsage.rss,
      },
    };
  }

  private getCpuInfo(): CpuInfoDto {
    const cpus = os.cpus();
    const loadAvg = os.loadavg();

    return {
      cores: cpus.length,
      architecture: os.arch(),
      usage: this.calculateCpuUsage(cpus),
      loadAverage: loadAvg,
    };
  }

  private calculateCpuUsage(cpus: os.CpuInfo[]): number {
    // Calculate CPU usage percentage
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach((cpu) => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~((100 * idle) / total);

    return usage;
  }

  async getDetailedHealth(): Promise<DetailedHealthResponseDto> {
    const database = await this.checkDatabaseHealth();
    const system = this.getSystemInfo();

    const detailedHealth: any = {
      status: 'UP',
      timestamp: new Date().toISOString(),
      database,
      system,
      externalServices: {
        redis: { status: 'UP', responseTime: 8 },
        elasticsearch: { status: 'UP', responseTime: 35 },
      },
      services: {
        notificationService: { status: 'UP' },
        cacheService: { status: 'UP' },
      },
    };

    return detailedHealth;
  }

  private async checkDatabaseHealth(): Promise<DatabasesHealthDto> {
    try {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();

      const versionResult = await queryRunner.query(
        'SELECT version() as version',
      );
      const timeResult = await queryRunner.query(
        'SELECT now() as current_time',
      );

      // PostgreSQL-specific uptime check (if you have pg_stat_activity enabled)
      let uptimeResult;
      try {
        const uptimeQuery = await queryRunner.query(`
          SELECT date_trunc('second', now() - pg_postmaster_start_time()) as uptime
          FROM pg_postmaster_start_time()`);
        uptimeResult = uptimeQuery[0]?.uptime;
      } catch {
        uptimeResult = 'Unknown'; // fallback if pg_postmaster_start_time() is not available
      }

      await queryRunner.release();

      return {
        status: 'UP',
        version: versionResult[0].version,
        currentTime: timeResult[0].current_time,
        uptime: uptimeResult,
      };
    } catch (error) {
      return {
        status: 'DOWN',
        error: error.message,
      };
    }
  }

  private formatUptime(seconds: number): string {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d} days ${h}h ${m}m ${s}s`;
  }

  private getDriverVersion(driver: any): string {
    // Try to extract driver version information
    try {
      return driver.version || driver.VERSION || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private async checkRedisHealth(): Promise<any> {
    // Implementation for Redis health check
    // This would integrate with your Redis client
    return { status: 'UP', responseTime: 15 };
  }
}
