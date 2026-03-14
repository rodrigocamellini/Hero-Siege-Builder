import { onAuthStateChanged, type User } from 'firebase/auth';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, type Timestamp } from 'firebase/firestore';
import { firebaseAuth, firestore } from '../../firebase';

const DEFAULT_AVATAR_URL = '/images/avatar.webp';

type Role = 'USER' | 'CONTRIBUTOR' | 'MODERATOR' | 'PARTNER' | 'DEVELOPER';
type UserProfile = {
  uid: string;
  email: string | null;
  displayName: string | null;
  nick: string | null;
  photoURL: string | null;
  role: Role;
  createdAt: Timestamp | null;
};

type AuthState = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
};

const AuthContext = createContext<AuthState>({ user: null, profile: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(firebaseAuth, (u) => {
      setUser(u);
      if (!u) setProfile(null);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    let unsub: (() => void) | null = null;
    const syncAndSubscribe = async () => {
      const userRef = doc(firestore, 'users', user.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email ?? null,
          displayName: user.displayName ?? null,
          nick: null,
          photoURL: user.photoURL ?? DEFAULT_AVATAR_URL,
          role: 'USER',
          createdAt: serverTimestamp(),
        });
      }
      unsub = onSnapshot(userRef, (s) => {
        if (!s.exists()) {
          setProfile(null);
          return;
        }
        const data = s.data() as Partial<UserProfile>;
        const role: Role =
          data.role === 'CONTRIBUTOR' || data.role === 'MODERATOR' || data.role === 'PARTNER' || data.role === 'DEVELOPER' || data.role === 'USER'
            ? data.role
            : 'USER';
        setProfile({
          uid: String(data.uid ?? s.id),
          email: typeof data.email === 'string' ? data.email : null,
          displayName: typeof data.displayName === 'string' ? data.displayName : null,
          nick: typeof data.nick === 'string' ? data.nick : null,
          photoURL: typeof data.photoURL === 'string' ? data.photoURL : null,
          role,
          createdAt: data.createdAt ?? null,
        });
      });
    };
    void syncAndSubscribe();
    return () => {
      if (unsub) unsub();
    };
  }, [user]);

  const value = useMemo(() => ({ user, profile, loading }), [user, profile, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
