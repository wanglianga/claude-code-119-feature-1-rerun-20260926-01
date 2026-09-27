import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RainReschedule } from '../../entities/rain-reschedule.entity';
import { Screening } from '../../entities/screening.entity';
import { EquipmentAssignment } from '../../entities/equipment-assignment.entity';
import { TimelineEvent } from '../../entities/timeline-event.entity';
import { RainRescheduleService } from './rain-reschedule.service';
import { RainRescheduleController } from './rain-reschedule.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RainReschedule, Screening, EquipmentAssignment, TimelineEvent,
    ]),
  ],
  providers: [RainRescheduleService],
  controllers: [RainRescheduleController],
})
export class RainRescheduleModule {}
