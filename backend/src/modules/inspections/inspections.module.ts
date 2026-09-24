import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Inspection } from '../../entities/inspection.entity';
import { TimelineEvent } from '../../entities/timeline-event.entity';
import { InspectionsService } from './inspections.service';
import { InspectionsController } from './inspections.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Inspection, TimelineEvent])],
  providers: [InspectionsService],
  controllers: [InspectionsController],
})
export class InspectionsModule {}
