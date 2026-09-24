import {
  Body, Controller, Get, Param, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { EquipmentService } from './equipment.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('equipment')
export class EquipmentController {
  constructor(private readonly service: EquipmentService) {}

  @Get()
  list(@Query() query: { status?: string; type?: string; kitNo?: string }) {
    return this.service.list(query);
  }

  @Get('kits')
  kits() {
    return this.service.kits();
  }

  @Get('screening/:id/assignments')
  assignments(@Param('id') id: string) {
    return this.service.assignmentsOf(id);
  }

  /** 仓库按场次准备一整套 */
  @Post('screening/:id/prepare')
  @Roles('warehouse', 'street')
  prepare(@Param('id') id: string, @Req() req: any, @Body() body: { kitNo?: string }) {
    return this.service.prepareKit(id, req.user, body.kitNo);
  }

  /** 领取时扫码核对成套 */
  @Post('screening/:id/scan')
  @Roles('warehouse', 'site_manager', 'street')
  scan(@Param('id') id: string, @Req() req: any, @Body() body: { code: string }) {
    return this.service.scan(id, body.code, req.user);
  }

  /** 归还逐件登记 */
  @Post('screening/:id/return/:equipmentId')
  @Roles('warehouse', 'site_manager', 'street')
  returnItem(
    @Param('id') id: string,
    @Param('equipmentId') equipmentId: string,
    @Req() req: any,
    @Body() body: { result: 'returned_ok' | 'returned_damaged' | 'lost'; note?: string; compensationCents?: number },
  ) {
    return this.service.returnItem(id, equipmentId, req.user, body);
  }
}
