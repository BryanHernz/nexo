export interface IdentityAuth {
  verifyIdToken(token: string, checkRevoked: boolean): Promise<{
    uid: string; firebase?: { sign_in_provider?: string };
  }>;
  getUser(uid: string): Promise<{
    uid: string; disabled: boolean; providerData: { providerId: string }[];
  }>;
}

// Callers map this policy rejection to their existing HTTP error contract.
export class IneligibleIdentityError extends Error {}

export async function assertEligibleAccount(auth: IdentityAuth, uid: string): Promise<void> {
  const user = await auth.getUser(uid);
  if (user.disabled || user.uid !== uid) throw new Error('invalid_identity');
  if (!user.providerData.some(p => p.providerId === 'password')) {
    throw new IneligibleIdentityError('ineligible_identity');
  }
}

export async function eligibleUserUid(auth: IdentityAuth, token: string): Promise<string> {
  const decoded = await auth.verifyIdToken(token, true);
  await assertEligibleAccount(auth, decoded.uid);
  // A linked password provider must not make an anonymous session eligible.
  if (decoded.firebase?.sign_in_provider === 'anonymous') {
    throw new IneligibleIdentityError('ineligible_identity');
  }
  return decoded.uid;
}
