import { IsString, IsOptional, IsUUID, Matches, Length } from 'class-validator';

export class CreateDepartmentDto {
  @IsUUID()
  organizationId!: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsString()
  name!: string;

  @IsString()
  @Matches(/^[a-zA-Z0-9]+$/, {
    message: 'Code must be alphanumeric',
  })
  @Length(2, 10, {
    message: 'Code must be between 2 and 10 characters',
  })
  code!: string;
}
