import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Equipment } from '../../entities/equipment.entity';
import { EquipmentAssignment } from '../../entities/equipment-assignment.entity';
import { Screening } from '../../entities/screening.entity';
import { TimelineEvent } from '../../entities/timeline-event.entity';
import { EquipmentService } from './equipment.service';
import { EquipmentController } from './equipment.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Equipment, EquipmentAssignment, Screening, TimelineEvent])],
  providers: [EquipmentService],
  controllers: [EquipmentController],
})
export class EquipmentModule {}
