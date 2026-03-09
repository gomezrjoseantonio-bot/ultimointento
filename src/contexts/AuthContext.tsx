/**
 * PROTOTIPO - Auth Context
 * Para pruebas personales - NO USAR EN PRODUCCIÓN
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { mockAuthService, User } from '../services/mockAuthService';
import toast from 'react-hot-toast';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  updateSubscription: (plan: 'free' | 'starter' | 'professional') => Promise<void>;
  cancelSubscription: () => Promise<void>;
}

const AUTH_DISABLED_MESSAGE = 'La autenticación por email está desactivada temporalmente.';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize a demo session on mount while email auth is disabled
  useEffect(() => {
    const currentUser = mockAuthService.ensureDemoSession();
    setUser(currentUser);
    setLoading(false);
  }, []);

  const login = async (_email: string, _password: string) => {
    toast(AUTH_DISABLED_MESSAGE, { icon: 'ℹ️' });
  };

  const register = async (_email: string, _password: string, _name: string) => {
    toast(AUTH_DISABLED_MESSAGE, { icon: 'ℹ️' });
  };

  const logout = async () => {
    toast(AUTH_DISABLED_MESSAGE, { icon: 'ℹ️' });
  };

  const updateSubscription = async (plan: 'free' | 'starter' | 'professional') => {
    try {
      const updatedUser = await mockAuthService.updateSubscription(plan);
      setUser(updatedUser);
      toast.success(`Plan actualizado a ${plan.toUpperCase()}`);
    } catch (error) {
      toast.error('Error al actualizar suscripción');
      throw error;
    }
  };

  const cancelSubscription = async () => {
    try {
      const updatedUser = await mockAuthService.cancelSubscription();
      setUser(updatedUser);
      toast.success('Suscripción cancelada');
    } catch (error) {
      toast.error('Error al cancelar suscripción');
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        updateSubscription,
        cancelSubscription
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
