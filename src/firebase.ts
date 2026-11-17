import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  getDocFromServer,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

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
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
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
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export interface CloudDownloadInput {
  id: string;
  name: string;
  enName?: string;
  isAudio: boolean;
  sourceUrl?: string;
  platform?: string;
  sizeText?: string;
  createdAtMs: number;
}

export interface CloudDownloadRecord extends CloudDownloadInput {
  uid: string;
}

export function sanitizeDownloadId(rawId: string): string {
  const cleaned = String(rawId || '')
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .slice(0, 64);
  return cleaned || `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export async function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export async function signOutGoogle() {
  return signOut(auth);
}

export function subscribeAuthState(callback: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}

export async function syncUserProfile(user: User): Promise<void> {
  if (!user?.uid) return;
  const path = `users/${user.uid}/private/info`;
  const profileRef = doc(db, 'users', user.uid, 'private', 'info');

  const payload: Record<string, unknown> = {
    uid: user.uid,
    updatedAt: serverTimestamp(),
  };
  if (user.displayName) payload.displayName = user.displayName.slice(0, 120);
  if (user.email) payload.email = user.email.slice(0, 254);
  if (user.photoURL) payload.photoURL = user.photoURL.slice(0, 500);

  let exists = false;
  try {
    const snap = await getDoc(profileRef);
    exists = snap.exists();
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }

  if (exists) {
    const updatePayload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (user.displayName) updatePayload.displayName = user.displayName.slice(0, 120);
    if (user.email) updatePayload.email = user.email.slice(0, 254);
    if (user.photoURL) updatePayload.photoURL = user.photoURL.slice(0, 500);

    try {
      await updateDoc(profileRef, updatePayload);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  } else {
    try {
      await setDoc(profileRef, payload);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  }
}

function buildStrictDownloadDoc(uid: string, item: CloudDownloadInput) {
  const id = sanitizeDownloadId(item.id);
  const name = (item.name || (item.isAudio ? 'audio' : 'video')).trim().slice(0, 160) || 'download';
  const createdAtMs =
    typeof item.createdAtMs === 'number' && Number.isFinite(item.createdAtMs) && item.createdAtMs >= 0
      ? Math.floor(item.createdAtMs)
      : Date.now();

  const docData: Record<string, unknown> = {
    id,
    uid,
    name,
    isAudio: Boolean(item.isAudio),
    createdAtMs,
    createdAt: serverTimestamp(),
  };

  if (item.enName && item.enName.trim()) {
    docData.enName = item.enName.trim().slice(0, 160);
  }
  if (item.sourceUrl && item.sourceUrl.trim()) {
    docData.sourceUrl = item.sourceUrl.trim().slice(0, 1000);
  }
  if (item.platform && item.platform.trim()) {
    docData.platform = item.platform.trim().slice(0, 40);
  }
  if (item.sizeText && item.sizeText.trim() && item.sizeText.trim() !== '—') {
    docData.sizeText = item.sizeText.trim().slice(0, 32);
  }

  return { id, docData };
}

export async function uploadDownloadItems(
  uid: string,
  items: CloudDownloadInput[],
  knownCloudIds?: Set<string>
): Promise<number> {
  if (!uid || !items.length) return 0;
  const colPath = `users/${uid}/downloads`;
  const colRef = collection(db, 'users', uid, 'downloads');

  let existingIds = knownCloudIds;
  if (!existingIds) {
    try {
      const q = query(colRef, where('uid', '==', uid));
      const snap = await getDocs(q);
      existingIds = new Set(snap.docs.map((d) => d.id));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, colPath);
    }
  }

  const pending = items
    .map((item) => buildStrictDownloadDoc(uid, item))
    .filter(({ id }) => !existingIds!.has(id));

  if (!pending.length) return 0;

  let uploaded = 0;
  for (let i = 0; i < pending.length; i += 400) {
    const chunk = pending.slice(i, i + 400);
    const batch = writeBatch(db);
    for (const { id, docData } of chunk) {
      batch.set(doc(db, 'users', uid, 'downloads', id), docData);
      existingIds.add(id);
    }
    try {
      await batch.commit();
      uploaded += chunk.length;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, colPath);
    }
  }
  return uploaded;
}

export function subscribeUserDownloads(
  uid: string,
  onData: (records: CloudDownloadRecord[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const colPath = `users/${uid}/downloads`;
  const q = query(collection(db, 'users', uid, 'downloads'), where('uid', '==', uid));

  return onSnapshot(
    q,
    (snapshot) => {
      const records: CloudDownloadRecord[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: typeof d.id === 'string' ? d.id : docSnap.id,
          uid: typeof d.uid === 'string' ? d.uid : uid,
          name: typeof d.name === 'string' ? d.name : 'download',
          enName: typeof d.enName === 'string' ? d.enName : undefined,
          isAudio: Boolean(d.isAudio),
          sourceUrl: typeof d.sourceUrl === 'string' ? d.sourceUrl : undefined,
          platform: typeof d.platform === 'string' ? d.platform : undefined,
          sizeText: typeof d.sizeText === 'string' ? d.sizeText : undefined,
          createdAtMs: typeof d.createdAtMs === 'number' ? d.createdAtMs : 0,
        };
      });
      records.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(records);
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.LIST, colPath);
    }
  );
}

export async function deleteAllUserDownloads(uid: string): Promise<void> {
  if (!uid) return;
  const colPath = `users/${uid}/downloads`;
  const colRef = collection(db, 'users', uid, 'downloads');

  let docsToDelete;
  try {
    const snap = await getDocs(query(colRef, where('uid', '==', uid)));
    docsToDelete = snap.docs;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, colPath);
  }

  for (let i = 0; i < docsToDelete.length; i += 400) {
    const chunk = docsToDelete.slice(i, i + 400);
    const batch = writeBatch(db);
    for (const d of chunk) {
      batch.delete(d.ref);
    }
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, colPath);
    }
  }
}

export async function eraseAllCloudUserData(uid: string): Promise<void> {
  if (!uid) return;
  await deleteAllUserDownloads(uid);
  const infoPath = `users/${uid}/private/info`;
  try {
    const profileRef = doc(db, 'users', uid, 'private', 'info');
    const snap = await getDoc(profileRef);
    if (snap.exists()) {
      const batch = writeBatch(db);
      batch.delete(profileRef);
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, infoPath);
  }
}
