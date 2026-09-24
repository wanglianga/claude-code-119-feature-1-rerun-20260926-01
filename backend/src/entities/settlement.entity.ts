import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Screening } from './screening.entity';
import { User } from './user.entity';

/**
 * 活动结束后的财务核销流水：设备归还、损坏赔付、投诉处理、版权核销、补贴发放
 * 都回到该场次记录。每笔财务动作一条流水。
 */
@Entity('settlements')
export class Settlement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Screening, (s) => s.settlements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'screening_id' })
  screening: Screening;

  @Column({ name: 'screening_id' })
  screeningId: string;

  /** damage_compensation 损坏赔付 / deposit_refund 押金退还 / deposit_deduct 押金扣减 /
   *  subsidy 补贴发放 / complaint_compensation 投诉赔付 / copyright_writeoff 版权核销 */
  @Column({ length: 32 })
  type: string;

  /** 金额（分），补贴/退还为正，扣减以 positive + 类型表达方向 */
  @Column({ type: 'bigint' })
  amountCents: string;

  @Column({ type: 'text', nullable: true })
  note: string;

  @ManyToOne(() => User, { eager: true, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'operator_id' })
  operator: User;

  @Column({ name: 'operator_id', nullable: true })
  operatorId: string;

  @CreateDateColumn()
  createdAt: Date;
}
