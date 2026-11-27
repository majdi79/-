# Security Specification — Family Fund (صندوق العائلة — Direct Access Mode)

## 1. Data Invariants & Relationship Mapping
- **Access Model (Per User Request)**: Google Sign-In was explicitly removed by the user so the family fund opens directly on computer and phone without an account login wall.
- **Master Source of Truth**: `/funds/{fundId}` represents a family fund workspace identified by a validated `fundId` (6–64 alphanumeric/underscore/hyphen characters). Top-level `list` on `/funds` is strictly denied (`allow list: if false`) to prevent enumeration of fund workspaces.
- **Relational Integrity**:
  - Every `FamilyMember` document requires parent `/funds/{fundId}` to exist and `data.fundId == fundId`.
  - Every `MonthlyPayment` document requires parent `/funds/{fundId}` and `/funds/{fundId}/members/{memberId}` (`existsAfter`) to exist on creation, deterministic ID `paymentId == memberId + '_' + monthKey`, and immutable `fundId`, `memberId`, `monthKey`, `createdAt`.
- **Schema & Temporal Hardening**:
  - Strict `hasAll` + `hasOnly` key allowlists on create and `affectedKeys().hasOnly(...)` action branches on update.
  - Strict `.size()` and regex bounds on all strings; numeric bounds `0 <= amount <= 1,000,000`.
  - Server-enforced timestamps (`createdAt == request.time`, `updatedAt == request.time`).

## 2. Adversarial Payloads Rejected by firestore.rules
1. **Fund Enumeration**: `LIST /funds` -> DENIED (`allow list: if false`).
2. **Short/Malformed Fund ID**: `GET /funds/abc` (< 6 chars) or `GET /funds/bad$id` -> DENIED (`isValidFundId`).
3. **Fund Deletion**: `DELETE /funds/family_fund_main` -> DENIED (`allow delete: if false`).
4. **Shadow Ghost Field Injection**: `CREATE /funds/family_fund_main/members/mem1` with extra `isAdmin: true` -> DENIED (`hasOnly`).
5. **Cross-Fund Reference Spoofing**: `CREATE /funds/fundA/members/mem1` with `fundId: "fundB"` -> DENIED (`data.fundId == fundId`).
6. **Path ID Poisoning**: `CREATE /funds/family_fund_main/members/bad!id` -> DENIED (`isValidId`).
7. **Orphaned Payment Write**: `CREATE /funds/family_fund_main/payments/ghost_2026-11` -> DENIED (`memberExistsAfter`).
8. **Duplicate / Non-Deterministic Payment ID**: `CREATE /funds/family_fund_main/payments/random123` -> DENIED (`paymentId == memberId + '_' + monthKey`).
9. **Client-Spoofed Timestamp**: `CREATE` with client timestamp instead of `request.time` -> DENIED.
10. **Immutable Field Tampering**: `UPDATE` changing `fundId`, `memberId`, `monthKey`, or `createdAt` -> DENIED.
11. **Value Poisoning**: `UPDATE` setting `monthlyAmount: -10` or 500-char string -> DENIED (`isValidMember`).
12. **Invalid Status / Month Key**: `CREATE` with `monthKey: "2026-13"` or `status: "unknown"` -> DENIED.
