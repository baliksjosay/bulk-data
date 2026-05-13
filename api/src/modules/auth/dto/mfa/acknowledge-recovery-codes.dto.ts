import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AcknowledgeRecoveryCodesDto {
  @ApiProperty({
    description: 'Recovery code batch identifier.',
    example: '3abf44fd-e4c7-4c7d-8b3f-68563d45f0cc',
  })
  @IsUUID()
  batchId: string;
}
