import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Screening } from '../../entities/screening.entity';
import { TimelineEvent } from '../../entities/timeline-event.entity';
import { Venue } from '../../entities/venue.entity';
import { Organizer } from '../../entities/organizer.entity';
import { Incident } from '../../entities/incident.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Screening) private readonly screeningRepo: Repository<Screening>,
    @InjectRepository(TimelineEvent) private readonly timelineRepo: Repository<TimelineEvent>,
    @InjectRepository(Venue) private readonly venueRepo: Repository<Venue>,
    @InjectRepository(Organizer) private readonly organizerRepo: Repository<Organizer>,
    @InjectRepository(Incident) private readonly incidentRepo: Repository<Incident>,
  ) {}

  /** 街道文体岗总览：按活动时间线追踪申请、审批、出库、搭建、放映、投诉、核销 */
  async overview() {
    const screenings = await this.screeningRepo.find({
      relations: ['venue', 'organizer'],
      order: { showDate: 'DESC' },
    });
    const byStatus: Record<string, number> = {};
    for (const s of screenings) byStatus[s.status] = (byStatus[s.status] || 0) + 1;

    const venues = await this.venueRepo.find();
    const riskyVenues = venues
      .map((v) => ({
        ...v,
        riskScore: v.noiseCount * 2 + v.damageCount * 3 + v.complaintCount,
      }))
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 8);

    const openIncidents = await this.incidentRepo.count({ where: [{ status: 'open' }, { status: 'handling' }] });
    const organizers = await this.organizerRepo.find({ order: { creditScore: 'ASC' } });

    const recentTimeline = await this.timelineRepo.find({
      order: { createdAt: 'DESC' },
      take: 30,
    });

    return {
      kpi: {
        totalScreenings: screenings.length,
        completed: byStatus['completed'] || 0,
        pendingReview: byStatus['pending_review'] || 0,
        inProgress: screenings.filter((s) =>
          ['equipment_prepared', 'equipment_checked_out', 'site_confirmed', 'screening'].includes(s.status)).length,
        openIncidents,
        blacklistedVenues: venues.filter((v) => v.blacklisted).length,
        postponed: byStatus['postponed'] || 0,
      },
      byStatus,
      riskyVenues,
      organizers: organizers.map((o) => ({
        id: o.id, name: o.name, organizerType: o.organizerType,
        creditScore: o.creditScore, violationCount: o.violationCount,
        rescheduleCount: o.rescheduleCount,
        totalScreenings: o.totalScreenings,
        depositBalance: Number(o.depositBalance),
      })),
      recentTimeline,
      recentScreenings: screenings.slice(0, 10).map((s) => ({
        id: s.id, code: s.code, title: s.title, status: s.status,
        showDate: s.showDate, venueName: s.venue?.name, organizerName: s.organizer?.name,
      })),
    };
  }
}
