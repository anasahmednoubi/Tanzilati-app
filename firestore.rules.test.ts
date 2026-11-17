// Phase 0 Adversarial Security Spec Test Cases ("Dirty Dozen")
export const DIRTY_DOZEN_CASES = [
  { name: 'unauthenticated_read', path: 'users/u1/downloads/d1', op: 'get', auth: null, expected: 'PERMISSION_DENIED' },
  { name: 'unauthenticated_create', path: 'users/u1/downloads/d1', op: 'create', auth: null, expected: 'PERMISSION_DENIED' },
  { name: 'cross_user_read', path: 'users/victim/downloads/d1', op: 'get', auth: { uid: 'attacker', email_verified: true }, expected: 'PERMISSION_DENIED' },
  { name: 'cross_user_list', path: 'users/victim/downloads', op: 'list', auth: { uid: 'attacker', email_verified: true }, expected: 'PERMISSION_DENIED' },
  { name: 'unverified_email_create', path: 'users/u1/downloads/d1', op: 'create', auth: { uid: 'u1', email_verified: false }, expected: 'PERMISSION_DENIED' },
  { name: 'uid_spoof_create', path: 'users/attacker/downloads/d1', op: 'create', auth: { uid: 'attacker', email_verified: true }, payload: { id: 'd1', uid: 'victim', name: 'x.mp4', isAudio: false, createdAtMs: 1 }, expected: 'PERMISSION_DENIED' },
  { name: 'id_mismatch_create', path: 'users/u1/downloads/d1', op: 'create', auth: { uid: 'u1', email_verified: true }, payload: { id: 'other', uid: 'u1', name: 'x.mp4', isAudio: false, createdAtMs: 1 }, expected: 'PERMISSION_DENIED' },
  { name: 'shadow_field_injection', path: 'users/u1/downloads/d1', op: 'create', auth: { uid: 'u1', email_verified: true }, payload: { id: 'd1', uid: 'u1', name: 'x.mp4', isAudio: false, createdAtMs: 1, isAdmin: true }, expected: 'PERMISSION_DENIED' },
  { name: 'oversized_name_poisoning', path: 'users/u1/downloads/d1', op: 'create', auth: { uid: 'u1', email_verified: true }, payload: { id: 'd1', uid: 'u1', name: 'a'.repeat(500), isAudio: false, createdAtMs: 1 }, expected: 'PERMISSION_DENIED' },
  { name: 'invalid_doc_id_chars', path: 'users/u1/downloads/bad$id!', op: 'create', auth: { uid: 'u1', email_verified: true }, payload: { id: 'bad$id!', uid: 'u1', name: 'x.mp4', isAudio: false, createdAtMs: 1 }, expected: 'PERMISSION_DENIED' },
  { name: 'forged_timestamp', path: 'users/u1/downloads/d1', op: 'create', auth: { uid: 'u1', email_verified: true }, payload: { id: 'd1', uid: 'u1', name: 'x.mp4', isAudio: false, createdAtMs: 1, createdAt: '1999-01-01T00:00:00Z' }, expected: 'PERMISSION_DENIED' },
  { name: 'pii_private_list_blocked', path: 'users/u1/private', op: 'list', auth: { uid: 'u1', email_verified: true }, expected: 'PERMISSION_DENIED' },
] as const;
