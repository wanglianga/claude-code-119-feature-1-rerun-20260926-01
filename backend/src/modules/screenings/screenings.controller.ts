import {
  Body, Controller, Get, Param, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ScreeningsService } from './screenings.service';
import { CreateScreeningDto } from './dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('screenings')
export class ScreeningsController {
  constructor(private readonly service: ScreeningsService) {}

  @Get()
  list(@Req() req: any, @Query() query: { status?: string; venueId?: string }) {
    return this.service.list(req.user, query);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.service.detail(id);
  }

  @Post()
  @Roles('applicant', 'street')
  create(@Req() req: any, @Body() dto: CreateScreeningDto) {
    return this.service.create(req.user, dto);
  }

  @Post(':id/submit')
  submit(@Param('id') id: string, @Req() req: any) {
    return this.service.submit(id, req.user);
  }

  @Post(':id/review')
  @Roles('reviewer')
  review(
    @Param('id') id: string,
    @Req() req: any,
    @Body() body: { approved: boolean; comment?: string; filingNo?: string },
  ) {
    return this.service.review(id, req.user, body);
  }

  @Post(':id/confirm-site')
  @Roles('site_manager', 'street')
  confirmSite(@Param('id') id: string, @Req() req: any) {
    return this.service.confirmSite(id, req.user);
  }

  @Post(':id/start')
  @Roles('site_manager', 'street')
  start(@Param('id') id: string, @Req() req: any) {
    return this.service.startScreening(id, req.user);
  }
}
