export type RouteCandidate = {
  ownerUserId: number;
  createdAt: Date;
};

/** A candidate created after submission is never eligible, even if it later matches the number. */
export function selectSingleEligibleRecipient(
  candidates: RouteCandidate[],
  senderUserId: number,
  submittedAt: Date,
): RouteCandidate | null {
  const eligible = candidates.filter((candidate) => candidate.createdAt <= submittedAt);
  if (eligible.length !== 1 || eligible[0].ownerUserId === senderUserId) return null;
  return eligible[0];
}

export function isExpired(expiresAt: Date, now: Date): boolean {
  return expiresAt.getTime() <= now.getTime();
}

export function canAccessThread(
  thread: { participantAUserId: number; participantBUserId: number },
  userId: number,
): boolean {
  return thread.participantAUserId === userId || thread.participantBUserId === userId;
}

export function otherParticipant(
  thread: { participantAUserId: number; participantBUserId: number },
  userId: number,
): number | null {
  if (thread.participantAUserId === userId) return thread.participantBUserId;
  if (thread.participantBUserId === userId) return thread.participantAUserId;
  return null;
}

export function isVisibleToUser(
  message: { senderUserId: number; suppressedForUserId: number | null },
  userId: number,
): boolean {
  return message.senderUserId === userId || message.suppressedForUserId !== userId;
}
