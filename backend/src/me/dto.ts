import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** Drill names the app uses (gymModel.ts DrillKind). */
export const DRILLS = ['reason', 'deeper', 'read', 'recall', 'names', 'remember', 'steady'] as const;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_BATCH = 500;
const DAY_MS = 24 * 60 * 60 * 1000;
/** 2020-01-01 to 2100-01-01: anything else is a broken clock or a bad request. */
const MIN_TIME = 1_577_836_800_000;
const MAX_TIME = 4_102_444_800_000;

// ---- Settings ----------------------------------------------------------------------------

export class PutSettingsDto {
  @ApiProperty({ description: "The app's settings document", type: Object })
  @IsObject()
  data!: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'The version this edit is based on. Required once settings exist; a stale value is refused with 409.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  baseVersion?: number;
}

export class SettingsDto {
  @ApiProperty({ type: Object }) data!: Record<string, unknown>;
  @ApiProperty() version!: number;
  @ApiProperty() updatedAt!: string;
}

// ---- Consents ----------------------------------------------------------------------------

export class ConsentItemDto {
  @ApiProperty({ description: "The app's own id for this record (idempotency key)" })
  @IsString()
  @Length(1, 100)
  clientId!: string;

  @ApiProperty() @IsString() @Length(1, 64) purpose!: string;
  @ApiProperty() @IsString() @Length(1, 64) policyVersion!: string;
  @ApiProperty() @IsBoolean() granted!: boolean;
  @ApiProperty({ description: 'ISO-8601 UTC' }) @IsISO8601({ strict: true }) recordedAt!: string;
}

export class ConsentBatchDto {
  @ApiProperty({ type: [ConsentItemDto] })
  @IsArray()
  @ArrayMaxSize(MAX_BATCH)
  @ValidateNested({ each: true })
  @Type(() => ConsentItemDto)
  items!: ConsentItemDto[];
}

// ---- Focus sessions ----------------------------------------------------------------------

export class ReflectionDto {
  @ApiProperty({ enum: ['yes', 'some', 'no'] }) @IsIn(['yes', 'some', 'no']) progress!: string;
  @ApiProperty({ enum: ['none', 'few', 'many'] })
  @IsIn(['none', 'few', 'many'])
  interruptions!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class FocusSessionItemDto {
  @ApiProperty() @IsString() @Length(1, 100) clientId!: string;
  @ApiProperty() @IsString() @MaxLength(140) intention!: string;
  @ApiProperty() @IsInt() @Min(0) @Max(DAY_MS) plannedMs!: number;
  @ApiProperty() @IsInt() @Min(0) @Max(DAY_MS) actualMs!: number;
  @ApiProperty({ description: 'epoch ms' }) @IsInt() @Min(MIN_TIME) @Max(MAX_TIME) startedAt!: number;
  @ApiProperty({ description: 'epoch ms' }) @IsInt() @Min(MIN_TIME) @Max(MAX_TIME) endedAt!: number;
  @ApiProperty({ enum: ['completed', 'ended_early'] })
  @IsIn(['completed', 'ended_early'])
  status!: string;

  @ApiProperty() @IsInt() @Min(0) @Max(1000) pauses!: number;

  @ApiPropertyOptional({ type: ReflectionDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => ReflectionDto)
  reflection?: ReflectionDto | null;
}

export class FocusSessionBatchDto {
  @ApiProperty({ type: [FocusSessionItemDto] })
  @IsArray()
  @ArrayMaxSize(MAX_BATCH)
  @ValidateNested({ each: true })
  @Type(() => FocusSessionItemDto)
  items!: FocusSessionItemDto[];
}

// ---- Gym ---------------------------------------------------------------------------------

export class GymAttemptItemDto {
  @ApiProperty() @IsString() @Length(1, 100) clientId!: string;
  @ApiProperty({ enum: DRILLS }) @IsIn(DRILLS) drill!: string;
  @ApiProperty({ description: "The user's local day, YYYY-MM-DD" }) @Matches(DAY) date!: string;
  @ApiProperty({ description: 'epoch ms' }) @IsInt() @Min(MIN_TIME) @Max(MAX_TIME) at!: number;
  @ApiProperty() @IsNumber() @Min(0) @Max(1) score!: number;
  @ApiProperty() @IsInt() @Min(0) @Max(1000) correct!: number;
  @ApiProperty() @IsInt() @Min(0) @Max(1000) total!: number;
  @ApiProperty() @IsInt() @Min(0) @Max(DAY_MS) durationMs!: number;
  @ApiProperty({ type: Object }) @IsObject() detail!: Record<string, string | number | boolean>;
}

export class GymAttemptBatchDto {
  @ApiProperty({ type: [GymAttemptItemDto] })
  @IsArray()
  @ArrayMaxSize(MAX_BATCH)
  @ValidateNested({ each: true })
  @Type(() => GymAttemptItemDto)
  items!: GymAttemptItemDto[];
}

export class GymWorkoutItemDto {
  @ApiProperty({ description: 'YYYY-MM-DD' }) @Matches(DAY) date!: string;
  @ApiProperty({ enum: DRILLS, isArray: true })
  @IsArray()
  @ArrayMaxSize(12)
  @IsIn(DRILLS, { each: true })
  plan!: string[];

  @ApiProperty({ enum: DRILLS, isArray: true })
  @IsArray()
  @ArrayMaxSize(12)
  @IsIn(DRILLS, { each: true })
  done!: string[];

  @ApiPropertyOptional({ description: 'epoch ms', nullable: true })
  @IsOptional()
  @IsInt()
  @Min(MIN_TIME)
  @Max(MAX_TIME)
  completedAt?: number | null;
}

export class GymWorkoutBatchDto {
  @ApiProperty({ type: [GymWorkoutItemDto] })
  @IsArray()
  @ArrayMaxSize(MAX_BATCH)
  @ValidateNested({ each: true })
  @Type(() => GymWorkoutItemDto)
  items!: GymWorkoutItemDto[];
}

// ---- Paging ------------------------------------------------------------------------------

export class PageQueryDto {
  @ApiPropertyOptional({ default: 100, maximum: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @ApiPropertyOptional({ description: 'nextCursor from the previous page' })
  @IsOptional()
  @IsUUID()
  cursor?: string;
}

export class BatchResultDto {
  @ApiProperty({ description: 'Items stored or updated by this request' }) stored!: number;
}
