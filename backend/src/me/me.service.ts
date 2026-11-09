import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.ts';
import { PrismaService } from '../prisma/prisma.service.ts';
import type {
  ConsentItemDto,
  FocusSessionItemDto,
  GymAttemptItemDto,
  GymWorkoutItemDto,
  PageQueryDto,
} from './dto.ts';

const MAX_SETTINGS_BYTES = 64 * 1024;
const MAX_DETAIL_BYTES = 2 * 1024;
const bytes = (v: unknown) => Buffer.byteLength(JSON.stringify(v), 'utf8');
const ms = (d: Date | null) => (d ? d.getTime() : null);

/**
 * Everything a signed-in user owns. Every query here is scoped by `userId`, which comes only
 * from the verified access token, never from the request body or URL.
 */
@Injectable()
export class MeService {
  constructor(private readonly db: PrismaService) {}

  async profile(userId: string) {
    const u = await this.db.user.findUniqueOrThrow({ where: { id: userId } });
    return { id: u.id, email: u.email, createdAt: u.createdAt.toISOString() };
  }

  // ---- Settings (optimistic concurrency) --------------------------------------------

  async getSettings(userId: string) {
    const s = await this.db.userSettings.findUnique({ where: { userId } });
    if (!s) {
      throw new NotFoundException('No settings backed up yet.');
    }
    return { data: s.data as Record<string, unknown>, version: s.version, updatedAt: s.updatedAt.toISOString() };
  }

  async putSettings(userId: string, data: Record<string, unknown>, baseVersion?: number) {
    if (bytes(data) > MAX_SETTINGS_BYTES) {
      throw new BadRequestException('Settings are larger than 64 KB.');
    }
    const json = data as Prisma.InputJsonObject;
    const current = await this.db.userSettings.findUnique({ where: { userId } });
    if (!current) {
      try {
        const s = await this.db.userSettings.create({ data: { userId, data: json, version: 1 } });
        return { version: s.version, updatedAt: s.updatedAt.toISOString() };
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          return this.conflict(userId); // another device created it first
        }
        throw e;
      }
    }
    if (baseVersion === undefined || baseVersion !== current.version) {
      return this.conflict(userId);
    }
    // Only update if nobody changed it since we read it.
    const updated = await this.db.userSettings.updateMany({
      where: { userId, version: baseVersion },
      data: { data: json, version: { increment: 1 } },
    });
    if (updated.count !== 1) {
      return this.conflict(userId);
    }
    const s = await this.db.userSettings.findUniqueOrThrow({ where: { userId } });
    return { version: s.version, updatedAt: s.updatedAt.toISOString() };
  }

  private async conflict(userId: string): Promise<never> {
    const s = await this.db.userSettings.findUniqueOrThrow({ where: { userId } });
    throw new ConflictException({
      message: 'Settings changed on another device. Merge with the current version and try again.',
      details: { version: s.version, data: s.data, updatedAt: s.updatedAt.toISOString() },
    });
  }

  // ---- Consents (append-only, idempotent) --------------------------------------------

  async addConsents(userId: string, items: ConsentItemDto[]) {
    const r = await this.db.consent.createMany({
      data: items.map(i => ({
        userId,
        clientId: i.clientId,
        purpose: i.purpose,
        policyVersion: i.policyVersion,
        granted: i.granted,
        recordedAt: new Date(i.recordedAt),
      })),
      skipDuplicates: true,
    });
    return { stored: r.count };
  }

  async listConsents(userId: string) {
    const rows = await this.db.consent.findMany({
      where: { userId },
      orderBy: [{ recordedAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map(c => ({
      clientId: c.clientId,
      purpose: c.purpose,
      policyVersion: c.policyVersion,
      granted: c.granted,
      recordedAt: c.recordedAt.toISOString(),
    }));
  }

  // ---- Focus sessions (upsert by the app's id: a later reflection updates the row) ----

  async upsertFocus(userId: string, items: FocusSessionItemDto[]) {
    for (const i of items) {
      if (i.endedAt < i.startedAt) {
        throw new BadRequestException(`Session ${i.clientId} ends before it starts.`);
      }
    }
    await this.db.$transaction(
      items.map(i => {
        const fields = {
          intention: i.intention,
          plannedMs: i.plannedMs,
          actualMs: i.actualMs,
          startedAt: new Date(i.startedAt),
          endedAt: new Date(i.endedAt),
          status: i.status,
          pauses: i.pauses,
          reflection: i.reflection
            ? ({ ...i.reflection } as Prisma.InputJsonObject)
            : Prisma.DbNull,
        };
        return this.db.focusSession.upsert({
          where: { userId_clientId: { userId, clientId: i.clientId } },
          create: { userId, clientId: i.clientId, ...fields },
          update: fields,
        });
      }),
    );
    return { stored: items.length };
  }

  async listFocus(userId: string, q: PageQueryDto) {
    const take = q.limit ?? 100;
    const rows = await this.db.focusSession.findMany({
      where: { userId },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });
    return this.page(rows, take, f => ({
      clientId: f.clientId,
      intention: f.intention,
      plannedMs: f.plannedMs,
      actualMs: f.actualMs,
      startedAt: f.startedAt.getTime(),
      endedAt: f.endedAt.getTime(),
      status: f.status,
      pauses: f.pauses,
      reflection: f.reflection ?? null,
    }));
  }

  // ---- Gym: attempts (insert once) and workout days (upsert) -------------------------

  async addAttempts(userId: string, items: GymAttemptItemDto[]) {
    for (const i of items) {
      if (bytes(i.detail) > MAX_DETAIL_BYTES) {
        throw new BadRequestException(`Attempt ${i.clientId} detail is larger than 2 KB.`);
      }
      if (i.correct > i.total) {
        throw new BadRequestException(`Attempt ${i.clientId} has more correct answers than questions.`);
      }
    }
    const r = await this.db.gymAttempt.createMany({
      data: items.map(i => ({
        userId,
        clientId: i.clientId,
        drill: i.drill,
        date: i.date,
        at: new Date(i.at),
        score: i.score,
        correct: i.correct,
        total: i.total,
        durationMs: i.durationMs,
        detail: i.detail as Prisma.InputJsonObject,
      })),
      skipDuplicates: true,
    });
    return { stored: r.count };
  }

  async listAttempts(userId: string, q: PageQueryDto) {
    const take = q.limit ?? 100;
    const rows = await this.db.gymAttempt.findMany({
      where: { userId },
      orderBy: [{ at: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });
    return this.page(rows, take, a => ({
      clientId: a.clientId,
      drill: a.drill,
      date: a.date,
      at: a.at.getTime(),
      score: a.score,
      correct: a.correct,
      total: a.total,
      durationMs: a.durationMs,
      detail: a.detail,
    }));
  }

  async upsertWorkouts(userId: string, items: GymWorkoutItemDto[]) {
    await this.db.$transaction(
      items.map(w => {
        const fields = {
          plan: w.plan,
          done: w.done,
          completedAt: w.completedAt ? new Date(w.completedAt) : null,
        };
        return this.db.gymWorkout.upsert({
          where: { userId_date: { userId, date: w.date } },
          create: { userId, date: w.date, ...fields },
          update: fields,
        });
      }),
    );
    return { stored: items.length };
  }

  async listWorkouts(userId: string) {
    const rows = await this.db.gymWorkout.findMany({ where: { userId }, orderBy: { date: 'asc' } });
    return rows.map(w => ({ date: w.date, plan: w.plan, done: w.done, completedAt: ms(w.completedAt) }));
  }

  // ---- Export and delete ------------------------------------------------------------

  /** Everything stored for this user, in one JSON document. */
  async export(userId: string) {
    const [profile, settings, consents, focus, attempts, workouts] = await Promise.all([
      this.profile(userId),
      this.db.userSettings.findUnique({ where: { userId } }),
      this.listConsents(userId),
      this.db.focusSession.findMany({ where: { userId }, orderBy: { startedAt: 'asc' } }),
      this.db.gymAttempt.findMany({ where: { userId }, orderBy: { at: 'asc' } }),
      this.listWorkouts(userId),
    ]);
    return {
      exportedAt: new Date().toISOString(),
      profile,
      settings: settings ? { data: settings.data, version: settings.version } : null,
      consents,
      focusSessions: focus.map(f => ({
        clientId: f.clientId,
        intention: f.intention,
        plannedMs: f.plannedMs,
        actualMs: f.actualMs,
        startedAt: f.startedAt.toISOString(),
        endedAt: f.endedAt.toISOString(),
        status: f.status,
        pauses: f.pauses,
        reflection: f.reflection ?? null,
      })),
      gymAttempts: attempts.map(a => ({
        clientId: a.clientId,
        drill: a.drill,
        date: a.date,
        at: a.at.toISOString(),
        score: a.score,
        correct: a.correct,
        total: a.total,
        durationMs: a.durationMs,
        detail: a.detail,
      })),
      gymWorkouts: workouts,
    };
  }

  /** Deletes the account and, through cascades, every row that belongs to it. */
  async deleteAccount(userId: string) {
    await this.db.user.delete({ where: { id: userId } });
  }

  private page<T extends { id: string }, R>(rows: T[], take: number, map: (r: T) => R) {
    const more = rows.length > take;
    const items = more ? rows.slice(0, take) : rows;
    return { items: items.map(map), nextCursor: more ? items[items.length - 1].id : null };
  }
}
