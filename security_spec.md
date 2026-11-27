# Security Specification — Family Fund (صندوق العائلة — Username & Password Auth)

## 1. Data Invariants & Relationship Mapping
- **Authentication**: Firebase Auth Email/Password provider backing username + password sign-in and account registration (`username` mapped internally to `username@familyfund.local`). Zero passwords or credential hashes are ever stored in Firestore or browser storage.
- **Master Source of Truth**: `/users/{userId}` represents a user's private family fund. Access to `/users/{userId}` and all subcollections (`/members`, `/payments`) is strictly restricted to `isOwner(userId)` (`request.auth != null && request.auth.uid == userId`). Access relies exclusively on Firebase Auth UID (never `request.auth.token.email`), preventing email-spoofing vectors while supporting username accounts.
- **PII Isolation**: Member names and WhatsApp phone numbers are strictly owner-isolated; `allow list: if false` on `/users`, and subcollection `allow list` strictly evaluates `isOwner(userId) && resource.data.ownerId == request.auth.uid` with zero `get()`/`exists()` inside `list`.
- **Relational & Temporal Integrity**:
  - `fundExists(userId)` Master Gate on single-doc subcollection operations.
  - `memberExistsAfter(userId, incoming().memberId)` and deterministic `paymentId == memberId + '_' + monthKey` on payment creation.
  - Server-enforced `createdAt == request.time`, `updatedAt == request.time`, and immutable `ownerId`, `memberId`, `monthKey`, `createdAt`.

## 2. The "Dirty Dozen" Adversarial Payloads (All Rejected with PERMISSION_DENIED)
1. Unauthenticated `GET /users/userA/members/mem1` -> DENIED (`isSignedIn()`).
2. Cross-tenant `GET /users/userA/members/mem1` as `userB` -> DENIED (`request.auth.uid == userId`).
3. Top-level `LIST /users` -> DENIED (`allow list: if false`).
4. Cross-tenant `LIST /users/userA/payments` as `userB` -> DENIED (`isOwner(userId) && resource.data.ownerId == request.auth.uid`).
5. Identity spoofing `CREATE /users/userA/members/mem1` with `ownerId: "userB"` -> DENIED.
6. Shadow ghost field injection (`isAdmin: true`) -> DENIED (`hasOnly`).
7. Path ID poisoning (`bad$id!`) -> DENIED (`isValidId`).
8. Orphaned payment creation for non-existent `memberId` -> DENIED (`memberExistsAfter`).
9. Non-deterministic payment ID -> DENIED (`paymentId == memberId + '_' + monthKey`).
10. Client-spoofed `createdAt` timestamp -> DENIED (`createdAt == request.time`).
11. Immutable field tampering on update (`monthKey`, `ownerId`, `createdAt`) -> DENIED.
12. Value poisoning (negative `monthlyAmount` or oversized string) -> DENIED (`isValidMember`).
