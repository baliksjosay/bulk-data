import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'Email address of the account requesting password reset.',
    example: 'joseph@example.com',
  })
  @IsEmail()
  email: string;
}

/**
 * Response returned after a password reset request is accepted.
 */
export class ForgotPasswordResponseDto {
  @ApiProperty({
    description: 'Acknowledgement message.',
    example:
      'If the account exists, password reset instructions have been issued.',
  })
  message: string;
}
