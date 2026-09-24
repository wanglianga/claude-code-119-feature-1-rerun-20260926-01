import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Settlement } from '../../entities/settlement.entity';
import { Screening } from '../../entities/screening.entity';
import { TimelineEvent } from '../../entities/timeline-event.entity';
import { Venue } from '../../entities/venue.entity';
import { Organizer } from '../../entities/organizer.entity';
import { OrganizersModule } from '../organizers/organizers.module';
import { SettlementsService } from './settlements.service';
import { SettlementsController } from './settlements.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Settlement, Screening, TimelineEvent, Venue, Organizer]),
    OrganizersModule,
  ],
  providers: [SettlementsService],
  controllers: [SettlementsController],
})
export class SettlementsModule {}
