# Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. No user can read, list, create, update, or delete any document under `/users/{userId}` unless signed in with a verified Google email (`request.auth.token.email_verified == true`) AND `request.auth.uid == userId`.
2. Private PII (`email`, `displayName`, `photoURL`) is isolated at `/users/{userId}/private/info` with `allow list: if false`.
3. Every download history record under `/users/{userId}/downloads/{downloadId}` must set `uid == request.auth.uid` and `id == downloadId`, enforced on both `create` and `list`.
4. All strings enforce bounded `.size()` checks matching `firebase-blueprint.json` (`id <= 64`, `uid <= 128`, `name <= 160`, `enName <= 160`, `sourceUrl <= 1000`, `platform <= 40`, `sizeText <= 32`, `email <= 254`, `displayName <= 120`, `photoURL <= 500`).
5. `createdAt` and `updatedAt` timestamps must strictly equal `request.time`.
6. Unknown/shadow keys are rejected via `keys().hasOnly(...)` on create and `affectedKeys().hasOnly(...)` on profile updates.

## 2. The "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. Unauthenticated read of `/users/u1/downloads/d1`.
2. Unauthenticated write to `/users/u1/downloads/d1`.
3. Cross-user get of `/users/victim/downloads/d1` by signed-in `attacker`.
4. Cross-user list query of `/users/victim/downloads` by signed-in `attacker`.
5. Unverified email account attempting create at `/users/u1/downloads/d1`.
6. Identity spoofing: setting `uid: "victim"` while creating `/users/attacker/downloads/d1`.
7. Path-ID mismatch: setting `id: "other"` at `/users/u1/downloads/d1`.
8. Shadow field injection: adding `isAdmin: true` to `/users/u1/downloads/d1`.
9. Resource poisoning: sending 1,000-character string in `name` (`> 160`).
10. Invalid document ID characters: `/users/u1/downloads/bad$id!`.
11. Fake client timestamp: sending custom past/future Date in `createdAt != request.time`.
12. Blanket list on PII path `/users/u1/private`.
