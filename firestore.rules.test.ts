/**
 * Security Rules Specification Verification Matrix (Dirty Dozen Adversarial Payloads)
 * Verifies that every adversarial payload violates at least one explicit guard in firestore.rules.
 */

export interface AdversarialTestCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: { uid: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
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
    enforcedBy: 'isVerifiedOwner(userId) -> isSignedIn()',
  },
  {
    id: 2,
    name: 'Cross-Tenant PII Read',
    operation: 'get',
    path: '/users/userA/members/mem1',
    auth: { uid: 'userB', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'isVerifiedOwner(userId) -> request.auth.uid == userId',
  },
  {
    id: 3,
    name: 'Unverified Email Write',
    operation: 'create',
    path: '/users/userA',
    auth: { uid: 'userA', email_verified: false },
    payload: {
      ownerId: 'userA',
      fundName: 'صندوق العائلة',
      currency: 'ر.س',
      reminderTemplate: 'تذكير',
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'isVerifiedUser() -> request.auth.token.email_verified == true',
  },
  {
    id: 4,
    name: 'Identity Spoofing on Create',
    operation: 'create',
    path: '/users/userA/members/mem1',
    auth: { uid: 'userA', email_verified: true },
    payload: {
      ownerId: 'userB',
      name: 'أحمد',
      phone: '+966500000000',
      relation: 'الأخ',
      monthlyAmount: 200,
      startMonth: '2026-01',
      isActive: true,
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'isValidMember -> data.ownerId == request.auth.uid && data.ownerId == userId',
  },
  {
    id: 5,
    name: 'Shadow Ghost Field Injection',
    operation: 'create',
    path: '/users/userA/members/mem1',
    auth: { uid: 'userA', email_verified: true },
    payload: {
      ownerId: 'userA',
      name: 'أحمد',
      phone: '+966500000000',
      relation: 'الأخ',
      monthlyAmount: 200,
      startMonth: '2026-01',
      isActive: true,
      isAdmin: true,
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'isValidMember -> data.keys().hasOnly([...])',
  },
  {
    id: 6,
    name: 'Path ID Poisoning',
    operation: 'create',
    path: '/users/userA/members/invalid$id!with..spaces',
    auth: { uid: 'userA', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'isValidId(memberId)',
  },
  {
    id: 7,
    name: 'Orphaned Payment Write',
    operation: 'create',
    path: '/users/userA/payments/ghost_2026-11',
    auth: { uid: 'userA', email_verified: true },
    payload: {
      ownerId: 'userA',
      memberId: 'ghost',
      monthKey: '2026-11',
      expectedAmount: 200,
      paidAmount: 200,
      status: 'paid',
      paidDate: '2026-11-26',
      note: '',
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'memberExists(userId, incoming().memberId)',
  },
  {
    id: 8,
    name: 'Client-Spoofed Timestamp',
    operation: 'create',
    path: '/users/userA/members/mem1',
    auth: { uid: 'userA', email_verified: true },
    payload: {
      ownerId: 'userA',
      name: 'أحمد',
      phone: '',
      relation: '',
      monthlyAmount: 200,
      startMonth: '2026-01',
      isActive: true,
      createdAt: '2020-01-01T00:00:00Z',
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'incoming().createdAt == request.time',
  },
  {
    id: 9,
    name: 'Immutable Field Tampering on Payment Update',
    operation: 'update',
    path: '/users/userA/payments/mem1_2026-11',
    auth: { uid: 'userA', email_verified: true },
    payload: {
      monthKey: '2026-12',
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'incoming().monthKey == existing().monthKey && affectedKeys().hasOnly(...)',
  },
  {
    id: 10,
    name: 'Value Poisoning (Negative Monthly Amount)',
    operation: 'update',
    path: '/users/userA/members/mem1',
    auth: { uid: 'userA', email_verified: true },
    payload: {
      monthlyAmount: -500,
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'isValidMember -> data.monthlyAmount >= 0 && data.monthlyAmount <= 1000000',
  },
  {
    id: 11,
    name: 'Invalid Enum / Regex Violation',
    operation: 'create',
    path: '/users/userA/payments/mem1_2026-13',
    auth: { uid: 'userA', email_verified: true },
    payload: {
      ownerId: 'userA',
      memberId: 'mem1',
      monthKey: '2026-13',
      expectedAmount: 200,
      paidAmount: 0,
      status: 'forgiven',
      paidDate: '',
      note: '',
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'isValidMonthKey(data.monthKey) && data.status in [paid, partial, unpaid]',
  },
  {
    id: 12,
    name: 'Cross-Tenant List Scraping',
    operation: 'list',
    path: '/users/userA/payments',
    auth: { uid: 'userB', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'allow list: if isVerifiedOwner(userId) && resource.data.ownerId == request.auth.uid',
  },
];
