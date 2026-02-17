import { dataClient } from '@/lib/data-client';

type UserProfile = {
  id: string;
  email: string;
  name?: string | null;
  dateOfBirth?: string | null;
  profileCompleted?: boolean | null;
};

export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const response = await dataClient.models.User.list({ limit: 1 });
  return (response?.data?.[0] as UserProfile | undefined) || null;
}

export async function upsertCurrentUserProfile(input: {
  email: string;
  name: string;
  dateOfBirth: string;
  profileCompleted: boolean;
}): Promise<UserProfile> {
  const existing = await getCurrentUserProfile();

  if (existing?.id) {
    const updated = await dataClient.models.User.update({
      id: existing.id,
      email: input.email,
      name: input.name,
      dateOfBirth: input.dateOfBirth,
      profileCompleted: input.profileCompleted,
    });
    return updated.data as UserProfile;
  }

  const created = await dataClient.models.User.create({
    email: input.email,
    name: input.name,
    dateOfBirth: input.dateOfBirth,
    profileCompleted: input.profileCompleted,
  });
  return created.data as UserProfile;
}
