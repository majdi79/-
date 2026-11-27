# Security Specification — Family Fund (صندوق العائلة)

## 1. Data Invariants & Relationship Mapping
- **Master Source of Truth**: `/users/{userId}` represents a treasurer's private family fund. Access to all subcollections (`/users/{userId}/members/{memberId}` and `/users/{userId}/payments/{paymentId}`) is strictly derived from verified ownership of `{userId}` (`request.auth.uid == userId && request.auth.token.email_verified == true`) and existence of the parent `/users/{userId}` document (Master Gate).
- **Relational Integrity**:
  - Every `FamilyMember` document requires `/users/{userId}` to exist and `ownerId == request.auth.uid`.
  - Every `MonthlyPayment` document requires `/users/{userId}` and `/users/{userId}/members/{memberId}` to exist on creation, `ownerId == request.auth.uid`, and immutable `ownerId`, `memberId`, `monthKey`, `createdAt`.
- **PII Isolation**:
  - `FamilyMember` documents store PII (`name`, `phone`). Blanket reads (`allow read: if isSignedIn()`) are strictly prohibited. Only the verified owner can `get`, `list`, `create`, `update`, or `delete`.
- **Secure List Queries**:
  - All `allow list` rules explicitly verify `isVerifiedOwner(userId) && resource.data.ownerId == request.auth.uid` with zero `get()`/`exists()` lookups inside `list`.
- **Temporal Integrity**:
  - `createdAt == request.time` on create; `updatedAt == request.time` on create and update; `createdAt` is immutable on update.

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return PERMISSION_DENIED)
1. **Unauthenticated Read on Members**: `GET /users/userA/members/mem1` with `auth = null`.
2. **Cross-Tenant PII Read**: `GET /users/userA/members/mem1` authenticated as `userB` (verified).
3. **Unverified Email Write**: `CREATE /users/userA` with `auth.uid = userA` and `email_verified = false`.
4. **Identity Spoofing on Create**: `CREATE /users/userA/members/mem1` as `userA` with `{ ownerId: "userB", ... }`.
5. **Shadow Ghost Field Injection**: `CREATE /users/userA/members/mem1` with extra field `isAdmin: true`.
6. **Path ID Poisoning**: `CREATE /users/userA/members/invalid$id!with..spaces` or 150-char ID.
7. **Orphaned Payment Write**: `CREATE /users/userA/payments/ghost_2026-11` where `memberId: "ghost"` does not exist in `/users/userA/members`.
8. **Client-Spoofed Timestamp**: `CREATE /users/userA/members/mem1` with `createdAt` set to a past date instead of `request.time`.
9. **Immutable Field Tampering**: `UPDATE /users/userA/payments/mem1_2026-11` modifying `monthKey` or `memberId` or `createdAt`.
10. **Value Poisoning (Type/Range Violation)**: `UPDATE /users/userA/members/mem1` setting `monthlyAmount: -500` or `name` to a 500-char string.
11. **Invalid Enum / Regex Violation**: `CREATE /users/userA/payments/mem1_2026-13` with `monthKey: "2026-13"` or `status: "forgiven"`.
12. **Cross-Tenant List Scraping**: `LIST /users/userA/payments` authenticated as `userB`.
