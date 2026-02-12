export enum View {
  LANDING = 'LANDING',
  CONNECTION = 'CONNECTION',
  TIMELINE = 'TIMELINE',
  FOCUS = 'FOCUS',
  ANNIVERSARY = 'ANNIVERSARY',
  PROFILE = 'PROFILE',
  ACCOUNT_SECURITY = 'ACCOUNT_SECURITY',
  EDIT_PROFILE = 'EDIT_PROFILE',
}

export interface User {
  id: string;
  email: string;
  // NOTE: passwordHash is intentionally excluded from frontend types — it only exists on the backend model.
  invitationCode: string; // User's own unique invite code
  boundInvitationCode?: string; // Invite code from another account that user has bound
  emailVerified?: boolean;
  createdAt: string;
  name?: string;
  avatar?: string;
  gender?: 'male' | 'female';
  partnerId?: string | null;
}

export interface ContentAuthor {
  id: string;
  name?: string;
  email?: string;
  avatar?: string;
  gender?: 'male' | 'female';
}

export interface AuthState {
  currentUser: User | null;
  users: User[];
}

export interface Memory {
  id: string;
  title: string;
  date: string;
  image: string;
  rotation: string;
  userId?: string;
  author?: ContentAuthor | null;
}

export interface YearStat {
  year: string;
  count: number;
  coverMemoryId: string;
}

export type EventType = string;

export const DEFAULT_EVENT_TYPES = ['纪念日', '生日', '旅行', '节日', '其他'] as const;

export interface AnniversaryEvent {
  id: string;
  title: string;
  subtitle: string;
  date: string; // YYYY-MM-DD
  type: EventType;
  image?: string;
  userId?: string;
  author?: ContentAuthor | null;
  createdAt?: string;
  updatedAt?: string;
}
