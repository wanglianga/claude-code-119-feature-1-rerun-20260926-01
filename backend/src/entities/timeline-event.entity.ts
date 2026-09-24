import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Screening } from './screening.entity';
import { User } from './user.entity';

/** 场次时间线：申请、审批、出库、搭建、放映、投诉、核销逐节点留痕，街道按活动时间线追踪 */
@Entity('timeline_events')
export class TimelineEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Screening, (s) => s.timeline, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'screening_id' })
  screening: Screening;

  @Column({ name: 'screening_id' })
  screeningId: string;

  /** apply/review/checkout/build/screening/complaint/settlement/incident 等 */
  @Column({ length: 32 })
  kind: string;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  detail: string;

  @Column({ length: 64, nullable: true })
  actorName: string;

  @Column({ length: 24, nullable: true })
  actorRole: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'actor_id' })
  actor: User;

  @Column({ name: 'actor_id', nullable: true })
  actorId: string;

  @CreateDateColumn()
  createdAt: Date;
}
