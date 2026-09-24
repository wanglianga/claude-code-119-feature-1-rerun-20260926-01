import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SettlementsService } from './settlements.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('screenings/:sid/settlements')
export class SettlementsController {
  constructor(private readonly service: SettlementsService) {}

  @Get()
  list(@Param('sid') sid: string) {
    return this.service.list(sid);
  }

  @Post()
  @Roles('finance', 'street')
  add(
    @Param('sid') sid: string,
    @Req() req: any,
    @Body() body: { type: string; amountCents: number; note?: string },
  ) {
    return this.service.addEntry(sid, req.user, body);
  }

  @Post('copyright-writeoff')
  @Roles('reviewer', 'finance', 'street')
  writeoff(
    @Param('sid') sid: string,
    @Req() req: any,
    @Body() body: { note?: string },
  ) {
    return this.service.copyrightWriteoff(sid, req.user, body?.note);
  }

  @Post('complete')
  @Roles('finance', 'street')
  complete(
    @Param('sid') sid: string,
    @Req() req: any,
    @Body() body: { finalRemark?: string },
  ) {
    return this.service.complete(sid, req.user, body?.finalRemark);
  }
}
