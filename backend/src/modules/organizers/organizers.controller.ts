import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { OrganizersService } from './organizers.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('organizers')
export class OrganizersController {
  constructor(private readonly service: OrganizersService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post(':id/violation')
  @Roles('street', 'finance')
  violation(@Param('id') id: string, @Body() body: { scoreDelta: number; remark?: string }) {
    return this.service.addViolation(id, body.scoreDelta, body.remark || '');
  }

  @Post(':id/deposit')
  @Roles('finance')
  deposit(@Param('id') id: string, @Body() body: { deltaCents: number }) {
    return this.service.adjustDeposit(id, body.deltaCents);
  }
}
