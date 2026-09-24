import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VolunteerCheckin } from '../../entities/volunteer-checkin.entity';
import { TimelineEvent } from '../../entities/timeline-event.entity';
import { VolunteersService } from './volunteers.service';
import { VolunteersController } from './volunteers.controller';

@Module({
  imports: [TypeOrmModule.forFeature([VolunteerCheckin, TimelineEvent])],
  providers: [VolunteersService],
  controllers: [VolunteersController],
})
export class VolunteersModule {}
