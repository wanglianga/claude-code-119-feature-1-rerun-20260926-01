import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Screening } from './screening.entity';
import { User } from './user.entity';

/**
 * 现场异常协同工单。覆盖：
 * film_corrupt 影片文件损坏 / equipment_missing 设备缺件 /
 * noise_complaint 居民投诉噪声 / rain 临时降雨 /
 * overcrowd 观众超员 / power_trip 供电跳闸 / extension 商户要求延长。
 * 申请方、审核员、仓库、现场负责人、安保、财务围绕同一场放映处理：
 * 各自以留言（IncidentReply）推进，状态 open -> handling -> resolved。
 */
@Entity('incidents')
export class Incident {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Screening, (s) => s.incidents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'screening_id' })
  screening: Screening;

  @Column({ name: 'screening_id' })
  screeningId: string;

  @Column({ length: 24 })
  type: string;

  @Column({ length: 24, default: 'open' })
  status: string; // open / handling / resolved

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'int', nullable: true })
  noiseDb: number;

  /** 严重等级 1-3 */
  @Column({ type: 'int', default: 1 })
  severity: number;

  /** 主责处理角色 */
  @Column({ length: 24, nullable: true })
  ownerRole: string;

  @ManyToOne(() => User, { eager: true, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @Column({ name: 'created_by', nullable: true })
  createdById: string;

  @Column({ type: 'text', nullable: true })
  resolution: string;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('incident_replies')
export class IncidentReply {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Incident, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'incident_id' })
  incident: Incident;

  @Column({ name: 'incident_id' })
  incidentId: string;

  @ManyToOne(() => User, { eager: true, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', nullable: true })
  userId: string;

  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn()
  createdAt: Date;
}
