import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Incident, IncidentReply } from '../../entities/incident.entity';
import { TimelineEvent } from '../../entities/timeline-event.entity';
import { Screening } from '../../entities/screening.entity';
import { VenuesModule } from '../venues/venues.module';
import { OrganizersModule } from '../organizers/organizers.module';
import { IncidentsService } from './incidents.service';
import { IncidentsController } from './incidents.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Incident, IncidentReply, TimelineEvent, Screening]),
    VenuesModule,
    OrganizersModule,
  ],
  providers: [IncidentsService],
  controllers: [IncidentsController],
})
export class IncidentsModule {}
