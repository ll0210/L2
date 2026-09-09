import { Type } from 'class-transformer';
import { IsEmail, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @Length(8, 128)
  password!: string;
}

export class RegisterDto extends LoginDto {
  @IsString()
  @Length(2, 80)
  username!: string;
}

export class SubmitFlagDto {
  @IsString()
  @Length(1, 512)
  flag!: string;
}

export class StartLabDto {
  @IsString()
  @Length(1, 100)
  challengeId!: string;
}

export class AiChatDto {
  @IsString()
  @Length(1, 1_000)
  message!: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  challengeId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  hintLevel?: number;
}
