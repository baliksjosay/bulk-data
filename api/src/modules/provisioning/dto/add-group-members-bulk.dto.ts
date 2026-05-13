import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { GroupMemberPairDto } from './group-member-pair.dto';

export class AddGroupMembersBulkDto {
  @ApiProperty({
    description:
      'Group members to add for the same or different primary MSISDNs in one request.',
    type: [GroupMemberPairDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => GroupMemberPairDto)
  groupMembers: GroupMemberPairDto[];
}
