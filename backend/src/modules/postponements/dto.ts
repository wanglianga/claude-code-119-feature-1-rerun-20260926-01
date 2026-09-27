import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

/** 现场负责人发起/补充强降雨改期材料 */
export class CreatePostponementDto {
  @IsOptional() @IsString()
  newShowDate?: string;

  @IsOptional() @IsString()
  newShowTime?: string;

  @IsOptional() @IsString()
  weatherShotUrl?: string;

  @IsOptional() @IsString()
  weatherNote?: string;

  @IsOptional() @IsString()
  equipmentOnSite?: string;

  @IsOptional() @IsString()
  audienceNotice?: string;

  @IsOptional() @IsString()
  merchantCoord?: string;
}

/** 四方沿用评估：版权 / 设备 / 安保 / 补贴 */
export class EvaluatePostponementDto {
  @IsString()
  dimension: 'copyright' | 'equipment' | 'security' | 'subsidy';

  @IsBoolean()
  reusable: boolean;

  @IsOptional() @IsString()
  note?: string;
}

/** 财务拆分已缴协办费：可退费用 / 已发生搭建成本 / 观众补偿 */
export class FeeSplitDto {
  @IsInt() @Min(0)
  coOrganizerFeePaid: number;

  @IsInt() @Min(0)
  refundableAmount: number;

  @IsInt() @Min(0)
  setupCost: number;

  @IsOptional() @IsInt() @Min(0)
  audienceCompensation?: number;

  @IsOptional() @IsString()
  feeNote?: string;

  @IsOptional() @IsBoolean()
  audienceCompNotified?: boolean;
}

/** 确认改期：落定新日期并生成新场次 */
export class ConfirmPostponementDto {
  @IsString()
  newShowDate: string;

  @IsOptional() @IsString()
  newShowTime?: string;

  /** 对主办方后续申请评分的扣减，默认 3 分；无责可传 0 */
  @IsOptional() @IsInt() @Min(0)
  creditPenalty?: number;

  @IsOptional() @IsString()
  remark?: string;
}
