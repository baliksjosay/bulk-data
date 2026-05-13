import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Current password of the user',
    example: 'CurrentPass123!',
  })
  @IsString()
  @MinLength(8, {
    message: 'Current password must be at least 8 characters long',
  })
  @MaxLength(128, { message: 'Current password cannot exceed 128 characters' })
  currentPassword: string;

  @ApiProperty({
    description:
      'New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    example: 'NewSecurePass123!',
    minLength: 8,
    maxLength: 128,
  })
  @IsString()
  @MinLength(8, { message: 'New password must be at least 8 characters long' })
  @MaxLength(128, { message: 'New password cannot exceed 128 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'New password must contain uppercase, lowercase, number and special character',
  })
  newPassword: string;

  @ApiPropertyOptional({
    description: 'Confirmation of the new password',
    example: 'NewSecurePass123!',
    required: false,
  })
  @IsString()
  @MinLength(8, {
    message: 'Confirmation password must be at least 8 characters long',
  })
  @MaxLength(128, {
    message: 'Confirmation password cannot exceed 128 characters',
  })
  confirmPassword?: string;

  // Ensure newPassword and confirmPassword match
  validatePasswordsMatch() {
    if (this.newPassword !== this.confirmPassword) {
      throw new Error('New password and confirmation do not match');
    }
  }

  // Optionally, you can add a method to return only the relevant fields for password change
  toChangePasswordPayload() {
    return {
      currentPassword: this.currentPassword,
      newPassword: this.newPassword,
    };
  }
}

export class ForgotPasswordDto {
  @ApiProperty({
    description:
      'Email address of the local account requesting password reset.',
    example: 'joseph@example.com',
  })
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Password reset token sent to the user.',
    example: '2f0c1d6b6a4a4b62a4d7...',
  })
  @IsString()
  token: string;

  @ApiProperty({
    description: 'New password to set for the account.',
    example: 'NewStrongPassword@123',
  })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
