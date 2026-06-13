import { IsString, MaxLength, MinLength } from 'class-validator';

export class EncryptDemoDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  plaintext!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  caseId!: string;
}
