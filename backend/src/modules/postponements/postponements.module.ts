import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RainPostponement } from '../../entities/rain-postponement.entity';
import { Screening } from '../../entities/screening.entity';
import { TimelineEvent } from '../../entities/timeline-event.entity';
import { EquipmentAssignment } from '../../entities/equipment-assignment.entity';
import { Equipment } from '../../entities/equipment.entity';
import { Settlement } from '../../entities/settlement.entity';
import { Organizer } from '../../entities/organizer.entity';
import { PostponementsService } from './postponements.service';
import { PostponementsController } from './postponements.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RainPostponement, Screening, TimelineEvent, EquipmentAssignment, Equipment, Settlement, Organizer,
    ]),
  ],
  providers: [PostponementsService],
  controllers: [PostponementsController],
})
export class PostponementsModule {}
