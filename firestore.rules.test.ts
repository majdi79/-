/**
 * Security Rules Verification Matrix (Username & Password Auth Mode)
 */

export interface AdversarialTestCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: { uid: string } | null;
  expectedResult: 'PERMISSION_DENIED';
  enforcedBy: string;
}

export const dirtyDozenCases: AdversarialTestCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Read on Members',
    operation: 'get',
    path: '/users/userA/members/mem1',
    auth: null,
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'isOwner(userId) -> isSignedIn()',
  },
  {
    id: 2,
    name: 'Cross-Tenant PII Read',
    operation: 'get',
    path: '/users/userA/members/mem1',
    auth: { uid: 'userB' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'isOwner(userId) -> request.auth.uid == userId',
  },
  {
    id: 3,
    name: 'Top-Level User Enumeration',
    operation: 'list',
    path: '/users',
    auth: { uid: 'userA' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'allow list: if false',
  },
  {
    id: 4,
    name: 'Cross-Tenant List Scraping',
    operation: 'list',
    path: '/users/userA/payments',
    auth: { uid: 'userB' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'isOwner(userId) && resource.data.ownerId == request.auth.uid',
  },
  {
    id: 5,
    name: 'Identity Spoofing on Create',
    operation: 'create',
    path: '/users/userA/members/mem1',
    auth: { uid: 'userA' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'isValidMember -> data.ownerId == request.auth.uid && data.ownerId == userId',
  },
  {
    id: 6,
    name: 'Shadow Ghost Field Injection',
    operation: 'create',
    path: '/users/userA/members/mem1',
    auth: { uid: 'userA' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'isValidMember -> data.keys().hasOnly([...])',
  },
  {
    id: 7,
    name: 'Path ID Poisoning',
    operation: 'create',
    path: '/users/userA/members/invalid$id!spaces',
    auth: { uid: 'userA' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'isValidId(memberId)',
  },
  {
    id: 8,
    name: 'Orphaned Payment Write',
    operation: 'create',
    path: '/users/userA/payments/ghost_2026-11',
    auth: { uid: 'userA' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'memberExistsAfter(userId, incoming().memberId)',
  },
  {
    id: 9,
    name: 'Non-Deterministic Payment ID',
    operation: 'create',
    path: '/users/userA/payments/random123',
    auth: { uid: 'userA' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'paymentId == incoming().memberId + "_" + incoming().monthKey',
  },
  {
    id: 10,
    name: 'Client-Spoofed Timestamp',
    operation: 'create',
    path: '/users/userA/members/mem1',
    auth: { uid: 'userA' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'incoming().createdAt == request.time',
  },
  {
    id: 11,
    name: 'Immutable Field Tampering',
    operation: 'update',
    path: '/users/userA/payments/mem1_2026-11',
    auth: { uid: 'userA' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'incoming().monthKey == existing().monthKey && affectedKeys().hasOnly(...)',
  },
  {
    id: 12,
    name: 'Value Poisoning (Negative Monthly Amount)',
    operation: 'update',
    path: '/users/userA/members/mem1',
    auth: { uid: 'userA' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'isValidMember -> data.monthlyAmount >= 0 && data.monthlyAmount <= 1000000',
  },
];
