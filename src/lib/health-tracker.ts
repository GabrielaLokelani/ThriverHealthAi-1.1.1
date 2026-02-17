import type { Goal, HealthMetric } from '@/types/health';
import { dataClient } from '@/lib/data-client';
import { generateGoalsFromChat, generateMetricsFromChat } from '@/lib/chat-insights';

function normalizeDate(input?: string): string {
  if (!input) {
    return new Date().toISOString().split('T')[0];
  }
  const dateOnly = input.split('T')[0];
  const parsed = new Date(dateOnly);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().split('T')[0];
  }
  return dateOnly;
}

function toIsoDateTime(input?: string): string | undefined {
  if (!input) {
    return undefined;
  }
  const date = normalizeDate(input);
  return `${date}T00:00:00.000Z`;
}

export async function listStoredMetrics(): Promise<HealthMetric[]> {
  const response = await dataClient.models.HealthMetric.list({ limit: 100 });
  const rows = (response?.data || []) as any[];

  return rows
    .map((row) => ({
      id: row.id,
      name: row.name,
      value: row.value || '',
      unit: row.unit || '',
      date: normalizeDate(row.date),
      notes: row.notes || '',
      createdAt: row.createdAt,
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function regenerateAndStoreMetrics(): Promise<HealthMetric[]> {
  const generated = await generateMetricsFromChat();

  if (!generated.length) {
    return listStoredMetrics();
  }

  const existing = await dataClient.models.HealthMetric.list({ limit: 100 });
  await Promise.all(
    ((existing?.data || []) as any[])
      .filter((row) => row?.id)
      .map((row) => dataClient.models.HealthMetric.delete({ id: row.id }))
  );

  const created = await Promise.all(
    generated.map((metric) =>
      dataClient.models.HealthMetric.create({
        name: metric.name,
        value: metric.value || '',
        unit: metric.unit || '',
        date: normalizeDate(metric.date),
        notes: metric.notes || '',
      })
    )
  );

  return created.map((result) => {
    const row = (result as any)?.data || {};
    return {
      id: row.id,
      name: row.name,
      value: row.value || '',
      unit: row.unit || '',
      date: normalizeDate(row.date),
      notes: row.notes || '',
      createdAt: row.createdAt,
    } satisfies HealthMetric;
  });
}

export async function listStoredGoals(): Promise<Goal[]> {
  const response = await dataClient.models.Goal.list({ limit: 100 });
  const rows = (response?.data || []) as any[];

  return rows
    .map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description || '',
      targetDate: row.targetDate || '',
      completed: !!row.completed,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }))
    .sort((a, b) => Number(a.completed) - Number(b.completed));
}

export async function regenerateAndStoreGoals(): Promise<Goal[]> {
  const generated = await generateGoalsFromChat();

  if (!generated.length) {
    return listStoredGoals();
  }

  const existing = await dataClient.models.Goal.list({ limit: 100 });
  await Promise.all(
    ((existing?.data || []) as any[])
      .filter((row) => row?.id)
      .map((row) => dataClient.models.Goal.delete({ id: row.id }))
  );

  const created = await Promise.all(
    generated.map((goal) =>
      dataClient.models.Goal.create({
        title: goal.title,
        description: goal.description || '',
        targetDate: toIsoDateTime(goal.targetDate),
        completed: !!goal.completed,
      })
    )
  );

  return created.map((result) => {
    const row = (result as any)?.data || {};
    return {
      id: row.id,
      title: row.title,
      description: row.description || '',
      targetDate: row.targetDate || '',
      completed: !!row.completed,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    } satisfies Goal;
  });
}

export async function toggleStoredGoal(goal: Goal): Promise<Goal> {
  const updated = await dataClient.models.Goal.update({
    id: goal.id,
    completed: !goal.completed,
  });

  const row = (updated as any)?.data || {};
  return {
    id: row.id || goal.id,
    title: row.title || goal.title,
    description: row.description || goal.description || '',
    targetDate: row.targetDate || goal.targetDate || '',
    completed: typeof row.completed === 'boolean' ? row.completed : !goal.completed,
    createdAt: row.createdAt || goal.createdAt,
    updatedAt: row.updatedAt || goal.updatedAt,
  };
}
