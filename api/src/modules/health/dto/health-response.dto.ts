import { ApiProperty } from '@nestjs/swagger';

export class DatabaseHealthDto {
  @ApiProperty({
    description: 'Database connection status',
    example: 'UP',
    enum: ['UP', 'DOWN'],
  })
  status: 'UP' | 'DOWN';

  @ApiProperty({
    description: 'Database connection URL (sanitized)',
    example: 'postgresql://localhost:5432/wendi_commission_validation',
    required: false,
  })
  url?: string;

  @ApiProperty({
    description: 'Database driver name',
    example: 'PostgreSQL JDBC Driver',
    required: false,
  })
  driverName?: string;

  @ApiProperty({
    description: 'Database driver version',
    example: '42.5.0',
    required: false,
  })
  driverVersion?: string;

  @ApiProperty({
    description: 'Error message if database is down',
    example: 'Connection timeout',
    required: false,
  })
  error?: string;

  @ApiProperty({
    description: 'Connection response time in milliseconds',
    example: 45,
    required: false,
  })
  responseTime?: number;

  @ApiProperty({
    description: 'Database schema/catalog name',
    example: 'wendi_commission_validation',
    required: false,
  })
  schema?: string;
}

export class MemoryInfoDto {
  @ApiProperty({
    description: 'Total memory allocated to Node.js process in bytes',
    example: 134217728,
  })
  totalMemory: number;

  @ApiProperty({
    description: 'Free memory available in bytes',
    example: 67108864,
  })
  freeMemory: number;

  @ApiProperty({
    description: 'Maximum memory that can be allocated in bytes',
    example: 1073741824,
  })
  maxMemory: number;

  @ApiProperty({
    description: 'Currently used memory in bytes',
    example: 67108864,
  })
  usedMemory: number;

  @ApiProperty({
    description: 'Memory usage percentage',
    example: 50.5,
  })
  usagePercentage: number;

  @ApiProperty({
    description: 'Heap memory statistics',
    example: {
      used: 45678912,
      total: 67108864,
      limit: 1073741824,
    },
  })
  heapUsage: {
    used: number;
    total: number;
    limit: number;
  };
}

export class CpuInfoDto {
  @ApiProperty({
    description: 'Number of CPU cores',
    example: 8,
  })
  cores: number;

  @ApiProperty({
    description: 'CPU architecture',
    example: 'x64',
  })
  architecture: string;

  @ApiProperty({
    description: 'Current CPU usage percentage',
    example: 15.5,
    required: false,
  })
  usage?: number;

  @ApiProperty({
    description: 'Load average (Unix systems)',
    example: [0.5, 0.7, 0.8],
    required: false,
  })
  loadAverage?: number[];
}

export class SystemInfoDto {
  @ApiProperty({
    description: 'Node.js version',
    example: 'v18.17.0',
  })
  nodeVersion: string;

  @ApiProperty({
    description: 'Operating system name',
    example: 'Linux',
  })
  osName: string;

  @ApiProperty({
    description: 'Operating system version',
    example: '5.15.0-72-generic',
  })
  osVersion: string;

  @ApiProperty({
    description: 'Operating system platform',
    example: 'linux',
  })
  platform: string;

  @ApiProperty({
    description: 'System hostname',
    example: 'wendi-app-server-01',
  })
  hostname: string;

  @ApiProperty({
    description: 'System uptime in seconds',
    example: 345600,
  })
  uptime: number;

  @ApiProperty({
    description: 'Process uptime in seconds',
    example: 3600,
  })
  processUptime: number;

  @ApiProperty({
    description: 'Memory information',
    type: MemoryInfoDto,
  })
  memory: MemoryInfoDto;

  @ApiProperty({
    description: 'CPU information',
    type: CpuInfoDto,
  })
  cpu: CpuInfoDto;

  @ApiProperty({
    description: 'Total system memory in bytes',
    example: 8589934592,
  })
  totalSystemMemory: number;

  @ApiProperty({
    description: 'Free system memory in bytes',
    example: 2147483648,
  })
  freeSystemMemory: number;
  @ApiProperty({
    description: 'Free system memory in bytes',
    example: 2147483648,
  })
  usedSystemMemory: number;

  database?: DatabasesHealthDto;
}

export class ApplicationInfoDto {
  @ApiProperty({
    description: 'Application name',
    example: 'Wendi Commission Validation',
  })
  name: string;

  @ApiProperty({
    description: 'Application version',
    example: '1.2.3',
  })
  version: string;

  @ApiProperty({
    description: 'Application environment',
    example: 'production',
    enum: ['development', 'staging', 'production', 'test'],
  })
  environment: string;

  @ApiProperty({
    description: 'Application build timestamp',
    example: '2024-07-15T10:30:00Z',
    required: false,
  })
  buildTime?: string;

  @ApiProperty({
    description: 'Application start time',
    example: '2024-07-15T09:00:00Z',
  })
  startTime: string;

  @ApiProperty({
    description: 'Git commit hash',
    example: 'a1b2c3d4e5f6',
    required: false,
  })
  gitCommit?: string;

  @ApiProperty({
    description: 'Git branch',
    example: 'main',
    required: false,
  })
  gitBranch?: string;
}

export class BasicHealthResponseDto {
  @ApiProperty({
    description: 'Overall health status',
    example: 'UP',
    enum: ['UP', 'DOWN', 'DEGRADED'],
  })
  status: 'UP' | 'DOWN' | 'DEGRADED';

  @ApiProperty({
    description: 'Health check timestamp',
    example: '2024-07-15T14:30:00Z',
  })
  timestamp: string;

  @ApiProperty({
    description: 'Application information',
    type: ApplicationInfoDto,
  })
  application: ApplicationInfoDto;

  @ApiProperty({
    description: 'Response time for health check in milliseconds',
    example: 125,
  })
  responseTime: number;
}

export class DatabasesHealthDto {
  @ApiProperty({ example: 'UP', description: 'Status of the primary database' })
  status: 'UP' | 'DOWN';

  @ApiProperty({
    example: 'PostgreSQL 16.3 on x86_64-redhat-linux-gnu',
    description: 'Database server version',
  })
  version?: string;

  @ApiProperty({
    example: '2025-07-13T17:56:41.123Z',
    description: 'Current database timestamp',
  })
  currentTime?: string;

  @ApiProperty({
    example: '3 days 04:18:12',
    description: 'Database uptime if available',
  })
  uptime?: string;

  @ApiProperty({
    example: 'Connection refused',
    description: 'Error message if database is DOWN',
    required: false,
  })
  error?: string;
}
export class HealthCheckFilterDto {
  @ApiProperty({
    description: 'Include database health checks',
    example: true,
    default: true,
    required: false,
  })
  includeDatabase?: boolean = true;

  @ApiProperty({
    description: 'Include system information',
    example: true,
    default: true,
    required: false,
  })
  includeSystem?: boolean = true;

  @ApiProperty({
    description: 'Include external services health',
    example: false,
    default: false,
    required: false,
  })
  includeExternalServices?: boolean = false;

  @ApiProperty({
    description: 'Include detailed memory information',
    example: true,
    default: true,
    required: false,
  })
  includeMemoryDetails?: boolean = true;
}

export class SystemInfoDto2 {
  @ApiProperty({
    example: 'macOS 14.5 (arm64)',
    description: 'Operating system and architecture',
  })
  platform: string;

  @ApiProperty({ example: 'v20.12.0', description: 'Node.js runtime version' })
  nodeVersion: string;

  @ApiProperty({
    example: '2.1 GB',
    description: 'Total system memory available',
  })
  totalMemory: string;

  @ApiProperty({ example: '780 MB', description: 'Free system memory' })
  freeMemory: string;

  @ApiProperty({
    example: '2025-07-13T17:57:00.124Z',
    description: 'Current system timestamp',
  })
  currentTime: string;

  @ApiProperty({
    example: '14 days 12:43:22',
    description: 'System uptime since last reboot',
  })
  uptime: string;

  @ApiProperty({ example: '4', description: 'Number of logical CPU cores' })
  cpuCores: number;
}

export class DetailedHealthResponseDto extends BasicHealthResponseDto {
  @ApiProperty({
    description: 'Database health status',
    type: DatabasesHealthDto,
  })
  database: DatabasesHealthDto;

  @ApiProperty({
    description: 'System information',
    type: SystemInfoDto,
  })
  system: SystemInfoDto;

  @ApiProperty({
    description: 'External services health (if any)',
    example: {
      redis: { status: 'UP', responseTime: 12 },
      elasticsearch: { status: 'UP', responseTime: 45 },
    },
    required: false,
  })
  externalServices?: Record<string, unknown>;

  @ApiProperty({
    description: 'Application-specific health checks',
    example: {
      cacheService: { status: 'UP' },
      notificationService: { status: 'UP' },
    },
    required: false,
  })
  services?: Record<string, unknown>;
}
