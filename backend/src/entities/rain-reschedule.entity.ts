import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { Screening } from './screening.entity';
import { User } from './user.entity';

/**
 * 现场搭建完成后遇强降雨的「雨天改期」处理单。
 *
 * 现场负责人需上传四类材料：
 *  weatherShot    气象截图
 *  equipmentArrived 已到场设备清单/照片
 *  audienceNotice 观众通知（取消/改期告知截图）
 *  merchantCoord   商户协调结果（周边商户顺延/补偿沟通）
 *
 * 平台逐项判定四项资源是否可沿用到改期后场次：
 *  copyrightReusable 版权授权日期是否仍覆盖新档期
 *  equipmentReusable 到场成套设备新档期是否被占用
 *  securityReusable  安保排班能否顺延
 *  subsidyReusable   补贴资格是否保留
 *
 * 若商户已缴协办费，财务拆分：
 *  coOrganizerFeeTotal 已缴协办费总额
 *  coOrganizerFeeRefund 可退费用
 *  rainBuildCost       已发生搭建成本（不退）
 *  audienceCompCents   观众补偿
 *
 * 改期结果通过 organizerCreditDelta 影响该主办方后续申请评分。
 * 原场次进入 postponed，不进入正常核销；rescheduledFromId 关联改期后新场次。
 */
@Entity('rain_reschedules')
export class RainReschedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @ManyToOne(() => Screening, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'screening_id' })
  screening: Screening;

  @Column({ name: 'screening_id' })
  screeningId: string;

  /** submitted 已提交待判定 / decided 四项判定完成 / rescheduled 已生成改期场 / rejected 不予改期 */
  @Column({ length: 16, default: 'submitted' })
  status: string;

  // ---------- 现场负责人上传的四类材料 ----------
  @Column({ length: 256, nullable: true })
  weatherShot: string;

  @Column({ type: 'text', nullable: true })
  equipmentArrived: string;

  @Column({ type: 'text', nullable: true })
  audienceNotice: string;

  @Column({ type: 'text', nullable: true })
  merchantCoord: string;

  /** 降雨实况说明（雨量/开始时间/现场处置） */
  @Column({ type: 'text', nullable: true })
  rainDetail: string;

  // ---------- 期望改期档期 ----------
  @Column({ type: 'date', nullable: true })
  newShowDate: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  newShowTime: string;

  // ---------- 平台四项沿用判定（审核员/仓库/安保/财务/街道） ----------
  @Column({ type: 'boolean', nullable: true })
  copyrightReusable: boolean;

  @Column({ type: 'boolean', nullable: true })
  equipmentReusable: boolean;

  @Column({ type: 'boolean', nullable: true })
  securityReusable: boolean;

  @Column({ type: 'boolean', nullable: true })
  subsidyReusable: boolean;

  @Column({ type: 'text', nullable: true })
  copyrightJudgeNote: string;

  @Column({ type: 'text', nullable: true })
  equipmentJudgeNote: string;

  @Column({ type: 'text', nullable: true })
  securityJudgeNote: string;

  @Column({ type: 'text', nullable: true })
  subsidyJudgeNote: string;

  /** 判定人 */
  @ManyToOne(() => User, { eager: true, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'judge_id' })
  judge: User;

  @Column({ name: 'judge_id', nullable: true })
  judgeId: string;

  @Column({ type: 'timestamptz', nullable: true })
  judgedAt: Date;

  // ---------- 商户协办费拆分（财务/街道） ----------
  /** 商户是否已缴协办费 */
  @Column({ type: 'boolean', default: false })
  coOrganizerFeePaid: boolean;

  /** 已缴协办费总额（分） */
  @Column({ type: 'bigint', default: 0 })
  coOrganizerFeeTotal: string;

  /** 可退费用（分） */
  @Column({ type: 'bigint', default: 0 })
  coOrganizerFeeRefund: string;

  /** 已发生搭建成本（分，不退） */
  @Column({ type: 'bigint', default: 0 })
  rainBuildCost: string;

  /** 观众补偿金额（分） */
  @Column({ type: 'bigint', default: 0 })
  audienceCompCents: string;

  /** 观众补偿通知方式/内容 */
  @Column({ type: 'text', nullable: true })
  audienceCompNotice: string;

  // ---------- 改期结果 ----------
  /** 生成的改期后新场次 */
  @Column({ name: 'new_screening_id', nullable: true })
  newScreeningId: string;

  /** 对主办方后续申请评分的影响（负分，如 -3） */
  @Column({ type: 'int', default: 0 })
  organizerCreditDelta: number;

  /** 评分影响说明 */
  @Column({ type: 'text', nullable: true })
  creditImpactNote: string;

  @Column({ type: 'text', nullable: true })
  finalRemark: string;

  @Column({ type: 'timestamptz', nullable: true })
  rescheduledAt: Date;

  @ManyToOne(() => User, { eager: true, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @Column({ name: 'created_by', nullable: true })
  createdById: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
