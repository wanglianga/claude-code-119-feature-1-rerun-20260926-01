import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organizer } from '../../entities/organizer.entity';
import { OrganizersService } from './organizers.service';
import { OrganizersController } from './organizers.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Organizer])],
  providers: [OrganizersService],
  controllers: [OrganizersController],
  exports: [OrganizersService],
})
export class OrganizersModule {}
