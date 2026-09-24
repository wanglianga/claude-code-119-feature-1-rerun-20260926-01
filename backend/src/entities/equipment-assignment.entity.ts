import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Unique,
} from 'typeorm';
import { Screening } from './screening.entity';
import { Equipment } from './equipment.entity';

/**
 * 场次-设备领用明细。仓库按场次准备设备（prepared），
 * 领取时逐件扫码核对成套状态（checked_out），归还时记录状态。
 */
@Entity('equipment_assignments')
@Unique(['screeningId', 'equipmentId'])
export class EquipmentAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Screening, (s) => s.equipmentAssignments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'screening_id' })
  screening: Screening;

  @Column({ name: 'screening_id' })
  screeningId: string;

  @ManyToOne(() => Equipment, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'equipment_id' })
  equipment: Equipment;

  @Column({ name: 'equipment_id' })
  equipmentId: string;

  /** prepared / checked_out / returned_damaged / returned_ok / lost */
  @Column({ length: 24, default: 'prepared' })
  state: string;

  @Column({ type: 'timestamptz', nullable: true })
  scannedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  returnedAt: Date;

  @Column({ type: 'text', nullable: true })
  returnNote: string;

  /** 单件核定赔付（分） */
  @Column({ type: 'bigint', default: 0 })
  compensation: string;

  @CreateDateColumn()
  createdAt: Date;
}
