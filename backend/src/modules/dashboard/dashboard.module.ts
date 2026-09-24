import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Screening } from '../../entities/screening.entity';
import { TimelineEvent } from '../../entities/timeline-event.entity';
import { Venue } from '../../entities/venue.entity';
import { Organizer } from '../../entities/organizer.entity';
import { Incident } from '../../entities/incident.entity';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Screening, TimelineEvent, Venue, Organizer, Incident])],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
