import { ApiProperty } from '@nestjs/swagger';

export class PaginationMetaDto {
  @ApiProperty({
    description: 'Current page number.',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Maximum number of records returned per page.',
    example: 20,
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of records matching the query.',
    example: 125,
  })
  total: number;

  @ApiProperty({
    description: 'Total number of pages.',
    example: 7,
  })
  totalPages: number;

  @ApiProperty({
    description: 'Whether another page is available after the current page.',
    example: true,
  })
  hasNextPage: boolean;

  @ApiProperty({
    description: 'Whether a page is available before the current page.',
    example: false,
  })
  hasPreviousPage: boolean;
}
