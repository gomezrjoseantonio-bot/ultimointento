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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const currentUser = mockAuthService.getCurrentUser();
    setUser(currentUser);
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const user = await mockAuthService.login(email, password);
      setUser(user);
      toast.success(`¡Bienvenido, ${user.name}!`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al iniciar sesión');
      throw error;
    }
  };

  const register = async (email: string, password: string, name: string) => {
    try {
      const user = await mockAuthService.register(email, password, name);
      setUser(user);
      toast.success('¡Cuenta creada exitosamente! 14 días de prueba gratis.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al registrarse');
      throw error;
    }
  };

  const logout = async () => {
    try {
      await mockAuthService.logout();
      setUser(null);
      toast.success('Sesión cerrada');
    } catch (error) {
      toast.error('Error al cerrar sesión');
      throw error;
    }
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
