import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Screening } from './screening.entity';
import { User } from './user.entity';

/**
 * 放映当天现场巡检/上报：
 * 搭建照片、试播截图、噪声分贝、观众区域隔离、消防通道情况。
 */
@Entity('inspections')
export class Inspection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Screening, (s) => s.inspections, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'screening_id' })
  screening: Screening;

  @Column({ name: 'screening_id' })
  screeningId: string;

  @ManyToOne(() => User, { eager: true, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reporter_id' })
  reporter: User;

  @Column({ name: 'reporter_id', nullable: true })
  reporterId: string;

  /** build_setup 搭建照片 / test_play 试播截图 / noise 噪声分贝 / isolation 观众隔离 / firelane 消防通道 */
  @Column({ length: 24 })
  category: string;

  /** 照片/截图 URL 或占位文件名（演示环境以文件名代替实际上传存储） */
  @Column({ length: 256, nullable: true })
  photoUrl: string;

  @Column({ type: 'numeric', precision: 6, scale: 1, nullable: true })
  noiseDb: number;

  @Column({ type: 'text', nullable: true })
  detail: string;

  @Column({ type: 'boolean', default: true })
  passed: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
