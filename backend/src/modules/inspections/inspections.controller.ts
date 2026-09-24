import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { InspectionsService } from './inspections.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('screenings/:sid/inspections')
export class InspectionsController {
  constructor(private readonly service: InspectionsService) {}

  @Get()
  list(@Param('sid') sid: string) {
    return this.service.list(sid);
  }

  @Post()
  @Roles('site_manager', 'security', 'street')
  upload(
    @Param('sid') sid: string,
    @Req() req: any,
    @Body() body: { category: string; photoUrl?: string; noiseDb?: number; detail?: string; passed?: boolean },
  ) {
    return this.service.upload(sid, req.user, body);
  }
}
