import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, Index,
} from 'typeorm';
import { Screening } from './screening.entity';

export type Role =
  | 'applicant'      // 申请方（社区/物业/商圈运营方）
  | 'reviewer'       // 文化审核人员
  | 'warehouse'      // 仓库管理员
  | 'site_manager'   // 现场负责人
  | 'security'       // 安保
  | 'finance'        // 财务
  | 'street';        // 街道文体岗

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ length: 64 })
  username: string;

  @Column({ length: 128 })
  password: string;

  @Column({ length: 64 })
  name: string;

  @Column({ type: 'varchar', length: 24 })
  role: Role;

  @Column({ length: 128, nullable: true })
  organization: string;

  // 申请方专属：所属主办方
  @Column({ length: 128, nullable: true })
  organizerName: string;

  @OneToMany(() => Screening, (s) => s.applicant)
  screenings: Screening[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
