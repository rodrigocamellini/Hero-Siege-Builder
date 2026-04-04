'use client';

export type GiveawayStatus = 'DRAFT' | 'OPEN' | 'CLOSED';

export type GiveawayDoc = {
  title: string;
  description: string;
  rules: string;
  prizeTitle: string;
  prizeImageUrl: string;
  status: GiveawayStatus;
  startAt: any;
  endAt: any;
  numWinners: number;
  entryCount?: number;
  winners?: Array<{ uid: string; displayName: string; nick?: string; photoURL: string | null; rank: number }>;
  drawnAt?: any;
  createdAt?: any;
  updatedAt?: any;
};

export type GiveawayRow = GiveawayDoc & { id: string };
