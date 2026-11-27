import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Unsubscribe,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import {
  DEFAULT_REMINDER_TEMPLATE,
  FamilyMember,
  FIELD_LIMITS,
  FIELD_PATTERNS,
  FIXED_CURRENCY,
  MonthlyPayment,
  PaymentStatus,
  UserFund,
} from './types';
import {
  addMonths,
  computePaymentStatus,
  getCurrentMonthKey,
  getTodayIsoDate,
  normalizePhoneInput,
} from './utils/format';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const firebaseProjectId = firebaseConfig.projectId;
export const firestoreDatabaseId = firebaseConfig.firestoreDatabaseId;

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export async function signInWithGoogle(): Promise<void> {
  await signInWithPopup(auth, googleProvider);
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

function clampAmount(val: number): number {
  if (!Number.isFinite(val) || val < FIELD_LIMITS.AMOUNT_MIN) return 0;
  if (val > FIELD_LIMITS.AMOUNT_MAX) return FIELD_LIMITS.AMOUNT_MAX;
  return Math.round(val * 1000) / 1000;
}

function sanitizeText(val: string, maxLen: number): string {
  return val.trim().slice(0, maxLen);
}

function generateSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const stamp = Date.now().toString(36);
  return `${prefix}_${stamp}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

/**
 * Ensures the user's parent fund document exists in /users/{userId}
 */
export async function ensureUserFund(userId: string): Promise<UserFund> {
  const fundPath = `users/${userId}`;
  const fundRef = doc(db, 'users', userId);
  try {
    const snap = await getDoc(fundRef);
    if (snap.exists()) {
      const existing = snap.data() as UserFund;
      if (existing.currency !== FIXED_CURRENCY) {
        await updateDoc(fundRef, {
          currency: FIXED_CURRENCY,
          updatedAt: serverTimestamp(),
        });
        return { ...existing, currency: FIXED_CURRENCY };
      }
      return existing;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, fundPath);
  }

  const initialFund = {
    ownerId: userId,
    fundName: 'صندوق العائلة',
    currency: FIXED_CURRENCY,
    reminderTemplate: DEFAULT_REMINDER_TEMPLATE,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(fundRef, initialFund);
    return {
      ownerId: userId,
      fundName: initialFund.fundName,
      currency: initialFund.currency,
      reminderTemplate: initialFund.reminderTemplate,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, fundPath);
  }
}

export function subscribeUserFund(
  userId: string,
  onData: (fund: UserFund | null) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${userId}`;
  return onSnapshot(
    doc(db, 'users', userId),
    (snapshot) => {
      onData(snapshot.exists() ? (snapshot.data() as UserFund) : null);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export function subscribeMembers(
  userId: string,
  onData: (members: FamilyMember[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${userId}/members`;
  const q = query(collection(db, 'users', userId, 'members'), where('ownerId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: FamilyMember[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<FamilyMember, 'id'>),
      }));
      items.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export function subscribePayments(
  userId: string,
  onData: (payments: MonthlyPayment[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${userId}/payments`;
  const q = query(collection(db, 'users', userId, 'payments'), where('ownerId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: MonthlyPayment[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<MonthlyPayment, 'id'>),
      }));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export async function updateFundSettings(
  userId: string,
  input: { fundName: string; reminderTemplate: string }
): Promise<void> {
  const path = `users/${userId}`;
  const fundName = sanitizeText(input.fundName, FIELD_LIMITS.FUND_NAME_MAX) || 'صندوق العائلة';
  const reminderTemplate =
    sanitizeText(input.reminderTemplate, FIELD_LIMITS.REMINDER_TEMPLATE_MAX) ||
    DEFAULT_REMINDER_TEMPLATE;

  try {
    await updateDoc(doc(db, 'users', userId), {
      fundName,
      currency: FIXED_CURRENCY,
      reminderTemplate,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createMember(
  userId: string,
  input: {
    name: string;
    phone: string;
    relation: string;
    monthlyAmount: number;
    startMonth: string;
    isActive: boolean;
  }
): Promise<string> {
  const memberId = generateSafeId('mem');
  const path = `users/${userId}/members/${memberId}`;
  const name = sanitizeText(input.name, FIELD_LIMITS.MEMBER_NAME_MAX);
  if (!name) throw new Error('يرجى إدخال اسم الفرد.');

  const phone = normalizePhoneInput(input.phone);
  const relation = sanitizeText(input.relation, FIELD_LIMITS.RELATION_MAX);
  const monthlyAmount = clampAmount(input.monthlyAmount);
  const startMonth = FIELD_PATTERNS.MONTH_KEY.test(input.startMonth)
    ? input.startMonth
    : getCurrentMonthKey();

  try {
    await setDoc(doc(db, 'users', userId, 'members', memberId), {
      ownerId: userId,
      name,
      phone,
      relation,
      monthlyAmount,
      startMonth,
      isActive: Boolean(input.isActive),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return memberId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateMember(
  userId: string,
  memberId: string,
  input: {
    name: string;
    phone: string;
    relation: string;
    monthlyAmount: number;
    startMonth: string;
    isActive: boolean;
  }
): Promise<void> {
  const path = `users/${userId}/members/${memberId}`;
  const name = sanitizeText(input.name, FIELD_LIMITS.MEMBER_NAME_MAX);
  if (!name) throw new Error('يرجى إدخال اسم الفرد.');

  const phone = normalizePhoneInput(input.phone);
  const relation = sanitizeText(input.relation, FIELD_LIMITS.RELATION_MAX);
  const monthlyAmount = clampAmount(input.monthlyAmount);
  const startMonth = FIELD_PATTERNS.MONTH_KEY.test(input.startMonth)
    ? input.startMonth
    : getCurrentMonthKey();

  try {
    await updateDoc(doc(db, 'users', userId, 'members', memberId), {
      name,
      phone,
      relation,
      monthlyAmount,
      startMonth,
      isActive: Boolean(input.isActive),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function toggleMemberActiveStatus(
  userId: string,
  memberId: string,
  isActive: boolean
): Promise<void> {
  const path = `users/${userId}/members/${memberId}`;
  try {
    await updateDoc(doc(db, 'users', userId, 'members', memberId), {
      isActive: Boolean(isActive),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteMemberAndPayments(
  userId: string,
  memberId: string,
  memberPaymentIds: string[]
): Promise<void> {
  const path = `users/${userId}/members/${memberId}`;
  try {
    if (memberPaymentIds.length === 0) {
      await deleteDoc(doc(db, 'users', userId, 'members', memberId));
      return;
    }
    const batch = writeBatch(db);
    memberPaymentIds.forEach((paymentId) => {
      batch.delete(doc(db, 'users', userId, 'payments', paymentId));
    });
    batch.delete(doc(db, 'users', userId, 'members', memberId));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveMonthlyPayment(
  userId: string,
  input: {
    memberId: string;
    monthKey: string;
    expectedAmount: number;
    paidAmount: number;
    paidDate: string;
    note: string;
    existingPayment?: MonthlyPayment;
  }
): Promise<void> {
  const paymentId = `${input.memberId}_${input.monthKey}`;
  const path = `users/${userId}/payments/${paymentId}`;
  const expectedAmount = clampAmount(input.expectedAmount);
  const paidAmount = clampAmount(input.paidAmount);
  const status: PaymentStatus = computePaymentStatus(paidAmount, expectedAmount);
  const rawDate = status === 'unpaid' ? '' : input.paidDate || getTodayIsoDate();
  const paidDate = FIELD_PATTERNS.DATE_STR.test(rawDate) ? rawDate : '';
  const note = sanitizeText(input.note, FIELD_LIMITS.NOTE_MAX);

  const ref = doc(db, 'users', userId, 'payments', paymentId);

  if (input.existingPayment) {
    try {
      await updateDoc(ref, {
        expectedAmount,
        paidAmount,
        status,
        paidDate,
        note,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  } else {
    try {
      await setDoc(ref, {
        ownerId: userId,
        memberId: input.memberId,
        monthKey: input.monthKey,
        expectedAmount,
        paidAmount,
        status,
        paidDate,
        note,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }
}

export async function recordReminderSent(
  userId: string,
  member: FamilyMember,
  monthKey: string,
  existingPayment?: MonthlyPayment
): Promise<void> {
  const paymentId = `${member.id}_${monthKey}`;
  const path = `users/${userId}/payments/${paymentId}`;
  const ref = doc(db, 'users', userId, 'payments', paymentId);

  if (existingPayment) {
    try {
      await updateDoc(ref, {
        lastRemindedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  } else {
    try {
      await setDoc(ref, {
        ownerId: userId,
        memberId: member.id,
        monthKey,
        expectedAmount: clampAmount(member.monthlyAmount),
        paidAmount: 0,
        status: member.monthlyAmount <= 0 ? 'paid' : 'unpaid',
        paidDate: '',
        note: '',
        lastRemindedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }
}

/**
 * Populates a realistic Arabic family fund sample dataset across 3 months so users can test reports & reminders immediately.
 */
export async function seedSampleFamilyData(userId: string): Promise<void> {
  const currentMonth = getCurrentMonthKey();
  const prevMonth1 = addMonths(currentMonth, -1);
  const prevMonth2 = addMonths(currentMonth, -2);
  const today = getTodayIsoDate();

  const sampleMembers = [
    { id: generateSafeId('mem'), name: 'عبدالله محمد', phone: '+97333112233', relation: 'الأخ الأكبر', monthlyAmount: 30 },
    { id: generateSafeId('mem'), name: 'سعد محمد', phone: '+97333223344', relation: 'أخ', monthlyAmount: 25 },
    { id: generateSafeId('mem'), name: 'فيصل محمد', phone: '+97333334455', relation: 'أخ', monthlyAmount: 20 },
    { id: generateSafeId('mem'), name: 'نورة محمد', phone: '+97333445566', relation: 'أخت', monthlyAmount: 15 },
    { id: generateSafeId('mem'), name: 'طارق العلي', phone: '+97333556677', relation: 'ابن العم', monthlyAmount: 20 },
    { id: generateSafeId('mem'), name: 'خالد محمد', phone: '+97333667788', relation: 'أخ', monthlyAmount: 15 },
  ];

  const batch = writeBatch(db);

  sampleMembers.forEach((m) => {
    batch.set(doc(db, 'users', userId, 'members', m.id), {
      ownerId: userId,
      name: m.name,
      phone: m.phone,
      relation: m.relation,
      monthlyAmount: m.monthlyAmount,
      startMonth: prevMonth2,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  // Historical payments for prevMonth2 & prevMonth1 + mixed currentMonth statuses
  sampleMembers.forEach((m, idx) => {
    // 2 months ago: all paid
    batch.set(doc(db, 'users', userId, 'payments', `${m.id}_${prevMonth2}`), {
      ownerId: userId,
      memberId: m.id,
      monthKey: prevMonth2,
      expectedAmount: m.monthlyAmount,
      paidAmount: m.monthlyAmount,
      status: 'paid',
      paidDate: `${prevMonth2}-05`,
      note: 'تحويل بنكي',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Last month: 5 paid, 1 partial
    const lastPaid = idx === 4 ? Math.round(m.monthlyAmount / 2) : m.monthlyAmount;
    batch.set(doc(db, 'users', userId, 'payments', `${m.id}_${prevMonth1}`), {
      ownerId: userId,
      memberId: m.id,
      monthKey: prevMonth1,
      expectedAmount: m.monthlyAmount,
      paidAmount: lastPaid,
      status: computePaymentStatus(lastPaid, m.monthlyAmount),
      paidDate: `${prevMonth1}-08`,
      note: idx === 4 ? 'دفعة أولى نقداً' : 'تحويل بنكي',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Current month: 3 paid, 1 partial, 2 unpaid
    if (idx < 3) {
      batch.set(doc(db, 'users', userId, 'payments', `${m.id}_${currentMonth}`), {
        ownerId: userId,
        memberId: m.id,
        monthKey: currentMonth,
        expectedAmount: m.monthlyAmount,
        paidAmount: m.monthlyAmount,
        status: 'paid',
        paidDate: today,
        note: 'تحويل بنكي',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else if (idx === 3) {
      const partialAmt = Math.round(m.monthlyAmount * 0.5);
      batch.set(doc(db, 'users', userId, 'payments', `${m.id}_${currentMonth}`), {
        ownerId: userId,
        memberId: m.id,
        monthKey: currentMonth,
        expectedAmount: m.monthlyAmount,
        paidAmount: partialAmt,
        status: 'partial',
        paidDate: today,
        note: 'دفعة جزئية',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}`);
  }
}
