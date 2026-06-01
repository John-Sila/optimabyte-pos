import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { User, Company, UserMapping } from '../types';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  company: Company | null;
  rights: string[];
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [rights, setRights] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fUser) => {
      // CRITICAL CHANGE: Do not flip loading states or clear profiles independently.
      // Keep loading true while the engine pulls documents down from Firestore.
      setLoading(true); 
      setError(null);

      if (!fUser) {
        setFirebaseUser(null);
        setUser(null);
        setCompany(null);
        setRights([]);
        setLoading(false);
        return;
      }

      try {
        const mappingRef = doc(db, 'users', fUser.uid);
        const mappingSnap = await getDoc(mappingRef);

        if (!mappingSnap.exists()) {
          setError('User mapping not found. Please contact your admin.');
          setLoading(false);
          return;
        }

        const { company: companyId } = mappingSnap.data() as UserMapping;

        const companyRef = doc(db, 'companies', companyId);
        const companySnap = await getDoc(companyRef);

        if (!companySnap.exists()) {
          setError('Company data not found.');
          setLoading(false);
          return;
        }

        const companyData = { id: companySnap.id, ...companySnap.data() } as Company;

        const userRef = doc(db, 'companies', companyId, 'users', fUser.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          setError('User profile not found in company.');
          setLoading(false);
          return;
        }

        const userData = userSnap.data() as User;

        // BATCH STATE UPDATES AT THE END:
        // Set everything together right here to prevent intermediate layout flash re-triggers.
        setFirebaseUser(fUser);
        setCompany(companyData);
        setUser(userData);
        setRights(Array.isArray((userData as any).rights) ? (userData as any).rights : []);

      } catch (err: any) {
        console.error('Error fetching auth data:', err);
        setError(err.message);
        // Clear variables out defensively on core system network errors
        setFirebaseUser(null);
        setUser(null);
        setCompany(null);
      } finally {
        // Safe to uncover layouts now
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, firebaseUser, company, rights, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}