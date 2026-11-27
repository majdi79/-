/**
 * Security Rules Verification Matrix (Direct Access /funds/{fundId} Mode)
 */

export interface AdversarialTestCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  expectedResult: 'PERMISSION_DENIED';
  enforcedBy: string;
}

export const dirtyDozenCases: AdversarialTestCase[] = [
  {
    id: 1,
    name: 'Top-Level Fund Enumeration',
    operation: 'list',
    path: '/funds',
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'allow list: if false',
  },
  {
    id: 2,
    name: 'Short or Malformed Fund ID',
    operation: 'get',
    path: '/funds/abc',
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'isValidFundId(fundId) -> id.size() >= 6',
  },
  {
    id: 3,
    name: 'Root Fund Deletion',
    operation: 'delete',
    path: '/funds/family_fund_main',
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'allow delete: if false',
  },
  {
    id: 4,
    name: 'Shadow Ghost Field Injection',
    operation: 'create',
    path: '/funds/family_fund_main/members/mem1',
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'isValidMember -> data.keys().hasOnly([...])',
  },
  {
    id: 5,
    name: 'Cross-Fund Reference Spoofing',
    operation: 'create',
    path: '/funds/fund_alpha/members/mem1',
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'isValidMember -> data.fundId == fundId',
  },
  {
    id: 6,
    name: 'Path ID Poisoning',
    operation: 'create',
    path: '/funds/family_fund_main/members/invalid$id!spaces',
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'isValidId(memberId)',
  },
  {
    id: 7,
    name: 'Orphaned Payment Write',
    operation: 'create',
    path: '/funds/family_fund_main/payments/ghost_2026-11',
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'memberExistsAfter(fundId, incoming().memberId)',
  },
  {
    id: 8,
    name: 'Non-Deterministic Payment ID',
    operation: 'create',
    path: '/funds/family_fund_main/payments/random123',
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'paymentId == incoming().memberId + "_" + incoming().monthKey',
  },
  {
    id: 9,
    name: 'Client-Spoofed Timestamp',
    operation: 'create',
    path: '/funds/family_fund_main/members/mem1',
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'incoming().createdAt == request.time',
  },
  {
    id: 10,
    name: 'Immutable Field Tampering',
    operation: 'update',
    path: '/funds/family_fund_main/payments/mem1_2026-11',
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'incoming().monthKey == existing().monthKey && affectedKeys().hasOnly(...)',
  },
  {
    id: 11,
    name: 'Value Poisoning (Negative Monthly Amount)',
    operation: 'update',
    path: '/funds/family_fund_main/members/mem1',
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'isValidMember -> data.monthlyAmount >= 0 && data.monthlyAmount <= 1000000',
  },
  {
    id: 12,
    name: 'Invalid Enum / MonthKey Regex Violation',
    operation: 'create',
    path: '/funds/family_fund_main/payments/mem1_2026-13',
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'isValidMonthKey(data.monthKey) && data.status in [paid, partial, unpaid]',
  },
];
