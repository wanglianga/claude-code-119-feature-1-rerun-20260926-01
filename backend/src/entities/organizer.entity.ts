import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

/**
 * 主办方信用档案：每个社区/物业/商圈运营方一条。
 * 投诉、设备损坏、超员等事件影响信用分；信用过低时押金上浮或限制申请。
 */
@Entity('organizers')
export class Organizer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ length: 128 })
  name: string;

  @Column({ length: 32, default: '社区' })
  organizerType: string;

  @Column({ length: 64 })
  contactName: string;

  @Column({ length: 32 })
  contactPhone: string;

  /** 信用分 0-100，初始 100 */
  @Column({ type: 'int', default: 100 })
  creditScore: number;

  /** 设备押金余额（分） */
  @Column({ type: 'bigint', default: 200000 })
  depositBalance: string;

  @Column({ type: 'int', default: 0 })
  totalScreenings: number;

  @Column({ type: 'int', default: 0 })
  violationCount: number;

  /** 因强降雨改期的场次次数（改期结果影响该主办方后续申请评分） */
  @Column({ type: 'int', default: 0 })
  rescheduleCount: number;

  @Column({ type: 'text', nullable: true })
  remark: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
