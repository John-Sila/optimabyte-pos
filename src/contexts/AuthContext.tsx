import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { User, Company, UserMapping } from '../types';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  company: Company | null;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fUser) => {
      setLoading(true);
      setFirebaseUser(fUser);
      
      if (fUser) {
        try {
          // 1. Get user mapping to find company
          const mappingRef = doc(db, 'users', fUser.uid);
          const mappingSnap = await getDoc(mappingRef);
          
          if (mappingSnap.exists()) {
            const { company: companyId } = mappingSnap.data() as UserMapping;
            
            // 2. Fetch company data
            const companyRef = doc(db, 'companies', companyId);
            const companySnap = await getDoc(companyRef);
            
            if (companySnap.exists()) {
              setCompany({ id: companySnap.id, ...companySnap.data() } as Company);
              
              // 3. Fetch user profile inside company
              const userRef = doc(db, 'companies', companyId, 'users', fUser.uid);
              const userSnap = await getDoc(userRef);
              
              if (userSnap.exists()) {
                setUser({ ...userSnap.data() } as User);
              } else {
                setError('User profile not found in company.');
              }
            } else {
              setError('Company data not found.');
            }
          } else {
            setError('User mapping not found. Please contact your admin.');
          }
        } catch (err: any) {
          console.error('Error fetching auth data:', err);
          setError(err.message);
        }
      } else {
        setUser(null);
        setCompany(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, firebaseUser, company, loading, error }}>
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
