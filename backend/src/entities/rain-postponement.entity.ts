import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { Screening } from './screening.entity';
import { User } from './user.entity';

/**
 * 强降雨改期处理（现场搭建完成后遇强降雨）。
 *
 * 现场负责人提交四类材料：
 *  - weatherShotUrl   气象预警/降雨截图
 *  - equipmentOnSite  已到场设备清点
 *  - audienceNotice   观众通知（改期/退票/补偿口径）
 *  - merchantCoord    商户协调结果（延长/撤场/费用）
 *
 * 平台四方分别判断原场次资源能否沿用到改期场次：
 *  - 审核员：版权授权日期是否覆盖新日期（copyrightReusable）
 *  - 仓库：已出库设备是否随套沿用/撤场（equipmentReusable）
 *  - 安保：安保排班能否顺延（securityReusable）
 *  - 财务：补贴资格是否保留（subsidyEligible）
 *
 * 财务对已缴协办费做三段拆分（分）：
 *  - coOrganizerFeePaid 已缴协办费总额
 *  - refundableAmount  可退费用
 *  - setupCost         已发生搭建成本（不退）
 *  - audienceCompensation 观众补偿（通知口径，可单独发放）
 *
 * 改期确认后克隆出新场次，原场次置为 postponed，不进入正常核销；
 * 结果（材料齐不齐、是否信用扣减）影响该主办方后续申请评分。
 */
@Entity('rain_postponements')
export class RainPostponement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 原（被改期）场次 */
  @ManyToOne(() => Screening, { eager: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'screening_id' })
  screening: Screening;

  @Index()
  @Column({ name: 'screening_id' })
  screeningId: string;

  /** 改期后生成的新场次（确认改期前为空） */
  @ManyToOne(() => Screening, { eager: false, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'new_screening_id' })
  newScreening: Screening;

  @Column({ name: 'new_screening_id', nullable: true })
  newScreeningId: string | null;

  /** 拟定改期日期/时间 */
  @Column({ type: 'date', nullable: true })
  newShowDate: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  newShowTime: string | null;

  // ---------- 现场负责人提交的四类材料 ----------
  /** 气象预警/强降雨截图（文件名/URL） */
  @Column({ type: 'varchar', length: 256, nullable: true })
  weatherShotUrl: string | null;

  @Column({ type: 'text', nullable: true })
  weatherNote: string | null;

  /** 已到场设备清点（文本/清单截图） */
  @Column({ type: 'text', nullable: true })
  equipmentOnSite: string | null;

  /** 观众通知（已通知方式与改期/退票口径） */
  @Column({ type: 'text', nullable: true })
  audienceNotice: string | null;

  /** 商户协调结果 */
  @Column({ type: 'text', nullable: true })
  merchantCoord: string | null;

  // ---------- 四方沿用评估 ----------
  /** 版权授权日期是否覆盖新日期 */
  @Column({ type: 'boolean', nullable: true })
  copyrightReusable: boolean | null;

  @Column({ type: 'text', nullable: true })
  copyrightNote: string | null;

  /** 设备占用：成套设备是否随套沿用（false=撤场回库） */
  @Column({ type: 'boolean', nullable: true })
  equipmentReusable: boolean | null;

  @Column({ type: 'text', nullable: true })
  equipmentNote: string | null;

  /** 安保排班能否顺延 */
  @Column({ type: 'boolean', nullable: true })
  securityReusable: boolean | null;

  @Column({ type: 'text', nullable: true })
  securityNote: string | null;

  /** 补贴资格是否保留 */
  @Column({ type: 'boolean', nullable: true })
  subsidyEligible: boolean | null;

  @Column({ type: 'text', nullable: true })
  subsidyNote: string | null;

  // ---------- 已缴协办费三段拆分（单位：分） ----------
  @Column({ type: 'bigint', default: 0 })
  coOrganizerFeePaid: string;

  @Column({ type: 'bigint', default: 0 })
  refundableAmount: string;

  @Column({ type: 'bigint', default: 0 })
  setupCost: string;

  @Column({ type: 'bigint', default: 0 })
  audienceCompensation: string;

  @Column({ type: 'text', nullable: true })
  feeNote: string | null;

  /** 观众补偿通知是否已触达 */
  @Column({ type: 'boolean', default: false })
  audienceCompNotified: boolean;

  // ---------- 信用影响 ----------
  /** 因改期对主办方后续申请评分的扣减（0 表示无责不扣） */
  @Column({ type: 'int', default: 0 })
  creditDelta: number;

  /**
   * draft     已建单待补材料
   * evaluating 材料齐备，四方评估中
   * fee_pending 四方评估完成，待财务拆分协办费
   * confirmed  已确认改期并生成新场次（原场次 postponed）
   */
  @Index()
  @Column({ length: 24, default: 'draft' })
  status: 'draft' | 'evaluating' | 'fee_pending' | 'confirmed';

  @ManyToOne(() => User, { eager: true, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @Column({ name: 'created_by', nullable: true })
  createdById: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  confirmedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
