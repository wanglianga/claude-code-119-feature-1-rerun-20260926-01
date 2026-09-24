import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IncidentsService } from './incidents.service';

@UseGuards(JwtAuthGuard)
@Controller('incidents')
export class IncidentsController {
  constructor(private readonly service: IncidentsService) {}

  @Get()
  list(@Query() query: { screeningId?: string; status?: string }) {
    return this.service.list(query.screeningId, query.status);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.service.detail(id);
  }

  /** 任何角色都可针对场次发起异常，系统按类型分派主责角色 */
  @Post('screening/:sid')
  create(
    @Param('sid') sid: string,
    @Req() req: any,
    @Body() body: { type: string; title?: string; description: string; noiseDb?: number; severity?: number },
  ) {
    return this.service.create(sid, req.user, body);
  }

  /** 六类角色围绕同一工单留言协同 */
  @Post(':id/replies')
  reply(
    @Param('id') id: string,
    @Req() req: any,
    @Body() body: { content: string; status?: string },
  ) {
    return this.service.reply(id, req.user, body.content, body.status);
  }

  @Post(':id/resolve')
  resolve(
    @Param('id') id: string,
    @Req() req: any,
    @Body() body: { resolution: string; confirmed?: boolean },
  ) {
    return this.service.resolve(id, req.user, body);
  }
}
