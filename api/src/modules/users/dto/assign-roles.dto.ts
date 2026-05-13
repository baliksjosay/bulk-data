import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsEnum } from 'class-validator';
import { UserRole } from '../enums/user-role.enum';

export class AssignRolesDto {
  @ApiProperty({
    description: 'Roles to assign to the user.',
    enum: UserRole,
    isArray: true,
    example: [UserRole.ADMIN],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(UserRole, { each: true })
  roles: UserRole[];
}
