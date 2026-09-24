import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { VolunteersService } from './volunteers.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('screenings/:sid/volunteers')
export class VolunteersController {
  constructor(private readonly service: VolunteersService) {}

  @Get()
  list(@Param('sid') sid: string) {
    return this.service.list(sid);
  }

  @Post()
  @Roles('site_manager', 'street')
  checkin(
    @Param('sid') sid: string,
    @Req() req: any,
    @Body() body: { volunteerName: string; phone: string; duty?: string },
  ) {
    return this.service.checkin(sid, req.user, body);
  }

  @Post(':id/checkout')
  @Roles('site_manager', 'street')
  checkout(@Param('sid') _sid: string, @Param('id') id: string, @Req() req: any) {
    return this.service.checkout(id, req.user);
  }
}
