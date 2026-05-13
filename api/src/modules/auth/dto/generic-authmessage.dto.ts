import { ApiProperty } from '@nestjs/swagger';

/**
 * Generic authentication-related message response.
 */
export class GenericAuthMessageDto {
  @ApiProperty({
    description: 'Operation result message.',
    example: 'Operation completed successfully.',
  })
  message: string;
}
