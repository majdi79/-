import { initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  getAuth,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  User,
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
  runTransaction,
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

const SYNTHETIC_EMAIL_DOMAIN = '@familyfund.local';

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
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
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

/**
 * Converts a username (or email) into the normalized email identifier used by Firebase Email/Password auth.
 */
export function normalizeUsernameInput(raw: string): string {
  return raw.trim().toLowerCase();
}

export function usernameToAuthEmail(usernameOrEmail: string): string {
  const cleaned = normalizeUsernameInput(usernameOrEmail);
  if (cleaned.includes('@')) {
    return cleaned;
  }
  return `${cleaned}${SYNTHETIC_EMAIL_DOMAIN}`;
}

export function extractDisplayUsername(user: User | null): string {
  const email = user?.email || '';
  if (!email) return 'مستخدم';
  if (email.endsWith(SYNTHETIC_EMAIL_DOMAIN)) {
    return email.slice(0, -SYNTHETIC_EMAIL_DOMAIN.length);
  }
  return email;
}

export function isPasswordAuthenticatedUser(user: User | null): boolean {
  if (!user) return false;
  return user.providerData.some((p) => p.providerId === 'password');
}

export interface AuthActionError {
  message: string;
  needsConsoleEnable?: boolean;
}

export function mapAuthErrorToArabic(error: unknown): AuthActionError {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';

  switch (code) {
    case 'auth/operation-not-allowed':
      return {
        message: 'مزود الدخول بالبريد/كلمة المرور غير مفعّل بعد في لوحة تحكم Firebase.',
        needsConsoleEnable: true,
      };
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return {
        message: 'اسم المستخدم أو كلمة المرور غير صحيحة.',
      };
    case 'auth/email-already-in-use':
      return {
        message: 'اسم المستخدم هذا مستخدم بالفعل. يرجى اختيار اسم مستخدم آخر أو تسجيل الدخول.',
      };
    case 'auth/weak-password':
      return {
        message: 'كلمة المرور ضعيفة جداً. يجب أن تتكون من 6 أحرف على الأقل.',
      };
    case 'auth/invalid-email':
      return {
        message: 'اسم المستخدم غير صالح. استخدم حروفاً إنجليزية وأرقاماً فقط بدون مسافات.',
      };
    case 'auth/too-many-requests':
      return {
        message: 'تم تجاوز عدد المحاولات المسموح بها مؤقتاً. يرجى الانتظار قليلاً ثم المحاولة مجدداً.',
      };
    case 'auth/network-request-failed':
      return {
        message: 'تعذّر الاتصال بالإنترنت. يرجى التحقق من الشبكة والمحاولة مرة أخرى.',
      };
    default:
      return {
        message: 'تعذّر إتمام العملية. يرجى التحقق من البيانات والمحاولة مرة أخرى.',
      };
  }
}

export async function signInWithUsernamePassword(
  username: string,
  password: string
): Promise<User> {
  const authEmail = usernameToAuthEmail(username);
  const credential = await signInWithEmailAndPassword(auth, authEmail, password);
  return credential.user;
}

export async function registerWithUsernamePassword(
  username: string,
  password: string
): Promise<User> {
  const authEmail = usernameToAuthEmail(username);
  const credential = await createUserWithEmailAndPassword(auth, authEmail, password);
  return credential.user;
}

export async function changeUserPassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.email) {
    throw new Error('لم يتم العثور على جلسة مستخدم نشطة.');
  }
  const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
  await reauthenticateWithCredential(currentUser, credential);
  await updatePassword(currentUser, newPassword);
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

const inFlightEnsureFund = new Map<string, Promise<UserFund>>();

/**
 * Atomically ensures the authenticated user's parent fund document exists in /users/{userId}.
 * Deduplicates concurrent calls (e.g., React StrictMode double-mount).
 */
export function ensureUserFund(userId: string, username: string): Promise<UserFund> {
  const existingPromise = inFlightEnsureFund.get(userId);
  if (existingPromise) {
    return existingPromise;
  }

  const fundPath = `users/${userId}`;
  const fundRef = doc(db, 'users', userId);
  const cleanUsername = sanitizeText(username, 64) || 'مستخدم';

  const task = (async (): Promise<UserFund> => {
    try {
      return await runTransaction(db, async (tx) => {
        const snap = await tx.get(fundRef);
        if (snap.exists()) {
          const existing = snap.data() as Partial<UserFund>;
          const needsUpdate =
            existing.currency !== FIXED_CURRENCY || !existing.username;
          const resolvedUsername = existing.username || cleanUsername;
          if (needsUpdate) {
            tx.update(fundRef, {
              username: resolvedUsername,
              currency: FIXED_CURRENCY,
              updatedAt: serverTimestamp(),
            });
          }
          return {
            ownerId: userId,
            username: resolvedUsername,
            fundName: existing.fundName || 'صندوق العائلة',
            currency: FIXED_CURRENCY,
            reminderTemplate: existing.reminderTemplate || DEFAULT_REMINDER_TEMPLATE,
            createdAt: existing.createdAt,
            updatedAt: existing.updatedAt,
          };
        }

        const initialFund = {
          ownerId: userId,
          username: cleanUsername,
          fundName: 'صندوق العائلة',
          currency: FIXED_CURRENCY,
          reminderTemplate: DEFAULT_REMINDER_TEMPLATE,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        tx.set(fundRef, initialFund);
        return {
          ownerId: userId,
          username: cleanUsername,
          fundName: initialFund.fundName,
          currency: initialFund.currency,
          reminderTemplate: initialFund.reminderTemplate,
        };
      });
    } catch (error) {
      try {
        const verifySnap = await getDoc(fundRef);
        if (verifySnap.exists()) {
          const data = verifySnap.data() as Partial<UserFund>;
          return {
            ownerId: userId,
            username: data.username || cleanUsername,
            fundName: data.fundName || 'صندوق العائلة',
            currency: FIXED_CURRENCY,
            reminderTemplate: data.reminderTemplate || DEFAULT_REMINDER_TEMPLATE,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          };
        }
      } catch {
        // Surface original error
      }
      handleFirestoreError(error, OperationType.CREATE, fundPath);
    }
  })();

  inFlightEnsureFund.set(userId, task);
  task.finally(() => {
    inFlightEnsureFund.delete(userId);
  });
  return task;
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

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists()) {
        tx.update(ref, {
          expectedAmount,
          paidAmount,
          status,
          paidDate,
          note,
          updatedAt: serverTimestamp(),
        });
      } else {
        tx.set(ref, {
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
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function recordReminderSent(
  userId: string,
  member: FamilyMember,
  monthKey: string,
  _existingPayment?: MonthlyPayment
): Promise<void> {
  const paymentId = `${member.id}_${monthKey}`;
  const path = `users/${userId}/payments/${paymentId}`;
  const ref = doc(db, 'users', userId, 'payments', paymentId);

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists()) {
        tx.update(ref, {
          lastRemindedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        tx.set(ref, {
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
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Populates a realistic Bahraini family fund sample dataset across 3 months.
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

  sampleMembers.forEach((m, idx) => {
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

    const lastPaid = idx === 4 ? Math.round((m.monthlyAmount / 2) * 1000) / 1000 : m.monthlyAmount;
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
      const partialAmt = Math.round(m.monthlyAmount * 0.5 * 1000) / 1000;
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
