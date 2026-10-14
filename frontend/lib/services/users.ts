'use client';

import { api } from '@/lib/services/http';

export type ConsoleRole = 'admin' | 'operator';

/** Someone with access to the console. `invited`: they have not set a password yet. */
export interface ConsoleUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: ConsoleRole;
  is_active: boolean;
  invited: boolean;
  last_login: string | null;
  date_joined: string;
}

export interface UserInvite {
  email: string;
  first_name: string;
  last_name: string;
  role: ConsoleRole;
}

const USERS = 'console/users/';

export async function fetchUsers(): Promise<ConsoleUser[]> {
  return (await api.get<{ count: number; results: ConsoleUser[] }>(USERS)).data.results;
}

export async function inviteUser(data: UserInvite): Promise<ConsoleUser & { invitation_sent: boolean }> {
  return (await api.post(USERS, data)).data;
}

export async function updateUser(id: number, changes: Partial<Pick<ConsoleUser, 'first_name' | 'last_name' | 'role' | 'is_active'>>): Promise<ConsoleUser> {
  return (await api.patch<ConsoleUser>(`${USERS}${id}/`, changes)).data;
}

export async function resendInvitation(id: number): Promise<ConsoleUser & { invitation_sent: boolean }> {
  return (await api.post(`${USERS}${id}/resend-invitation/`, {})).data;
}
