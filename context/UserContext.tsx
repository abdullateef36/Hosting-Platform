"use client";

import { createContext, useContext, useState, useEffect, useRef } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";

interface UserContextType {
  user: User | null;
  loading: boolean;
}

const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
});

let authInitialized = false;
let cachedUser: User | null = null;

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(cachedUser);
  const [loading, setLoading] = useState(!authInitialized);
  const setupRef = useRef(false);

  useEffect(() => {
    // Setup the listener only once globally
    if (!setupRef.current) {
      setupRef.current = true;

      const cached = localStorage.getItem("authUser");

      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          cachedUser = parsed;
          queueMicrotask(() => setUser(parsed));
        } catch {}
      }

      const firebaseAuth = auth;

      if (!firebaseAuth) {
        queueMicrotask(() => setLoading(false));
        return;
      }

      onAuthStateChanged(firebaseAuth, (firebaseUser) => {
        cachedUser = firebaseUser;
        queueMicrotask(() => {
          setUser(firebaseUser);
          setLoading(false);
          authInitialized = true;
        });

        if (firebaseUser) {
          localStorage.setItem("authUser", JSON.stringify(firebaseUser));
        } else {
          localStorage.removeItem("authUser");
        }
      });
    } else if (authInitialized) {
      // On subsequent mounts, immediately use cached values
      queueMicrotask(() => {
        setUser(cachedUser);
        setLoading(false);
      });
    }
  }, []);

  return (
    <UserContext.Provider value={{ user, loading }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
