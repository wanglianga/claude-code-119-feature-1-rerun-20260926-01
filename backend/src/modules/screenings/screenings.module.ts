import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Screening } from '../../entities/screening.entity';
import { TimelineEvent } from '../../entities/timeline-event.entity';
import { Venue } from '../../entities/venue.entity';
import { Organizer } from '../../entities/organizer.entity';
import { ScreeningsService } from './screenings.service';
import { ScreeningsController } from './screenings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Screening, TimelineEvent, Venue, Organizer])],
  providers: [ScreeningsService],
  controllers: [ScreeningsController],
  exports: [ScreeningsService, TypeOrmModule],
})
export class ScreeningsModule {}
