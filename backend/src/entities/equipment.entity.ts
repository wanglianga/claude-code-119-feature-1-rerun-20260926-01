import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, Index, JoinColumn,
} from 'typeorm';

export type EquipmentType =
  | 'projector' // 投影机
  | 'screen'    // 幕布
  | 'speaker'   // 音箱
  | 'cable'     // 电缆
  | 'bulb'      // 备用灯泡
  | 'raincoat'; // 防雨罩

export type EquipmentStatus = 'in_stock' | 'prepared' | 'checked_out' | 'returned' | 'damaged' | 'lost';

@Entity('equipments')
export class Equipment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 资产编码，扫码用，如 PJ-0001 */
  @Index({ unique: true })
  @Column({ length: 32 })
  code: string;

  @Column({ length: 64 })
  name: string;

  @Column({ type: 'varchar', length: 16 })
  type: EquipmentType;

  @Column({ type: 'varchar', length: 16, default: 'in_stock' })
  status: EquipmentStatus;

  /** 标准化的成套分组：一套露天放映设备六件，分组号一致 */
  @Column({ length: 32 })
  kitNo: string;

  @Column({ type: 'int', default: 100 })
  condition: number;

  @Column({ type: 'text', nullable: true })
  note: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
