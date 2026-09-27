import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PostponementsService } from './postponements.service';
import {
  CreatePostponementDto, EvaluatePostponementDto, FeeSplitDto, ConfirmPostponementDto,
} from './dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('screenings/:sid/postponement')
export class PostponementsController {
  constructor(private readonly service: PostponementsService) {}

  @Get()
  get(@Param('sid') sid: string) {
    return this.service.byScreening(sid);
  }

  /** 现场负责人（或街道）发起/补充四项改期材料 */
  @Post()
  @Roles('site_manager', 'street')
  submit(
    @Param('sid') sid: string,
    @Req() req: any,
    @Body() body: CreatePostponementDto,
  ) {
    return this.service.submitMaterials(sid, req.user, body);
  }

  /** 审核员/仓库/安保/财务分别评估版权·设备·安保·补贴沿用 */
  @Post('evaluate')
  @Roles('reviewer', 'warehouse', 'security', 'finance', 'street')
  evaluate(
    @Param('sid') sid: string,
    @Req() req: any,
    @Body() body: EvaluatePostponementDto,
  ) {
    return this.service.evaluateBySid(sid, req.user, body);
  }

  /** 财务拆分已缴协办费 + 观众补偿通知 */
  @Post('fee')
  @Roles('finance', 'street')
  fee(
    @Param('sid') sid: string,
    @Req() req: any,
    @Body() body: FeeSplitDto,
  ) {
    return this.service.feeBySid(sid, req.user, body);
  }

  /** 确认改期并克隆新场次 */
  @Post('confirm')
  @Roles('street', 'finance')
  confirm(
    @Param('sid') sid: string,
    @Req() req: any,
    @Body() body: ConfirmPostponementDto,
  ) {
    return this.service.confirmBySid(sid, req.user, body);
  }
}
