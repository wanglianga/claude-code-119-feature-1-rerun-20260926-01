import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Screening } from './screening.entity';
import { User } from './user.entity';

/** 志愿者签到：现场负责人确认到场志愿者 */
@Entity('volunteer_checkins')
export class VolunteerCheckin {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Screening, (s) => s.volunteerCheckins, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'screening_id' })
  screening: Screening;

  @Column({ name: 'screening_id' })
  screeningId: string;

  @Column({ length: 64 })
  volunteerName: string;

  @Column({ length: 32 })
  phone: string;

  /** 岗位：引导 / 秩序 / 设备协助 */
  @Column({ length: 32, default: '秩序维护' })
  duty: string;

  @Column({ type: 'timestamptz', nullable: true })
  checkedInAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  checkedOutAt: Date;

  @Column({ length: 24, default: 'checked_in' })
  state: string; // checked_in / checked_out / absent

  @ManyToOne(() => User, { eager: true, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'operator_id' })
  operator: User;

  @Column({ name: 'operator_id', nullable: true })
  operatorId: string;

  @CreateDateColumn()
  createdAt: Date;
}
