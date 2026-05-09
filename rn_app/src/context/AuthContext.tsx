import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  User as FirebaseUser 
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

interface User {
  uid: string;
  phoneNumber: string;
  email?: string;
  name?: string;
  hostel?: string;
  roomNumber?: string;
  collegeId?: string;
  collegeName?: string;
  address?: string;
  role?: 'customer' | 'admin' | 'store' | 'delivery';
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, pass: string) => Promise<string | null>;
  skipLogin: () => void;
  signOut: () => void;
  updateCollege: (id: string, name: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await fetchUserData(firebaseUser.uid);
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const fetchUserData = async (uid: string) => {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setUser({
          uid: uid,
          phoneNumber: data.phoneNumber || '',
          email: data.email,
          name: data.name,
          hostel: data.hostel,
          roomNumber: data.roomNumber,
          collegeId: data.collegeId,
          collegeName: data.collegeName,
          role: data.role || 'customer',
        });
      } else {
        // Create basic profile if missing
        const firebaseUser = auth.currentUser;
        if (firebaseUser) {
          const newUser: User = {
            uid: uid,
            phoneNumber: firebaseUser.phoneNumber || '',
            email: firebaseUser.email || undefined,
            name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
            address: 'Engineering Block A',
          };
          await setDoc(docRef, newUser);
          setUser(newUser);
        }
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  };

  const signIn = async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      setIsLoading(false);
      return null;
    } catch (error: any) {
      setIsLoading(false);
      return error.message;
    }
  };

  const skipLogin = () => {
    setUser({
      uid: 'guest_uid',
      phoneNumber: '+910000000000',
      name: 'Guest User',
      email: 'guest@zappit.com',
      collegeName: 'Campus'
    });
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const updateCollege = async (id: string, name: string) => {
    if (user && user.uid !== 'guest_uid') {
      try {
        await setDoc(doc(db, 'users', user.uid), {
          collegeId: id,
          collegeName: name,
        }, { merge: true });
        setUser({ ...user, collegeId: id, collegeName: name });
      } catch (error) {
        console.error("Error updating college:", error);
      }
    } else if (user) {
      setUser({ ...user, collegeId: id, collegeName: name });
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, skipLogin, signOut, updateCollege }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
