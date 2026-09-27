import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import {
  RainRescheduleService, SubmitRainDto, JudgeRainDto, FeeRainDto,
} from './rain-reschedule.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('rain-reschedules')
export class RainRescheduleController {
  constructor(private readonly service: RainRescheduleService) {}

  @Get()
  list(@Query('screeningId') screeningId?: string) {
    return this.service.list(screeningId);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.service.detail(id);
  }

  /** 现场负责人：现场搭建完成后遇强降雨，上传四类材料申请改期 */
  @Post('screening/:sid')
  @Roles('site_manager', 'applicant', 'street')
  submit(@Param('sid') sid: string, @Req() req: any, @Body() body: SubmitRainDto) {
    return this.service.submit(sid, req.user, body);
  }

  /**
   * 四项沿用判定：版权（审核员）、设备（仓库）、安保（安保）、补贴（财务）；
   * 街道可代任一方一次性判定。可多次提交，四项齐备后处理单进入 decided。
   */
  @Post(':id/judge')
  @Roles('reviewer', 'warehouse', 'security', 'finance', 'street')
  judge(@Param('id') id: string, @Req() req: any, @Body() body: JudgeRainDto) {
    return this.service.judge(id, req.user, body);
  }

  /** 财务：区分可退费用 / 已发生搭建成本 / 观众补偿通知（商户已缴协办费时） */
  @Post(':id/fee')
  @Roles('finance', 'street')
  fee(@Param('id') id: string, @Req() req: any, @Body() body: FeeRainDto) {
    return this.service.fee(id, req.user, body);
  }

  /** 执行改期：原场次 postponed 不核销，生成改期场，联动主办方评分 */
  @Post(':id/confirm')
  @Roles('reviewer', 'finance', 'street')
  confirm(
    @Param('id') id: string,
    @Req() req: any,
    @Body() body: { creditDelta?: number; creditImpactNote?: string; remark?: string },
  ) {
    return this.service.confirm(id, req.user, body);
  }

  /** 不予改期 */
  @Post(':id/reject')
  @Roles('reviewer', 'finance', 'street')
  reject(
    @Param('id') id: string,
    @Req() req: any,
    @Body() body: { reason?: string },
  ) {
    return this.service.reject(id, req.user, body?.reason || '');
  }
}
