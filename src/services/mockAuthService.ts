/**
 * PROTOTIPO - Mock Authentication Service
 * Para pruebas personales - NO USAR EN PRODUCCIÓN
 * 
 * Este servicio simula autenticación usando localStorage.
 * Reemplazar con Supabase Auth cuando se lance.
 */

export interface User {
  id: string;
  email: string;
  name: string;
  subscriptionPlan: 'free' | 'starter' | 'professional';
  subscriptionStatus: 'active' | 'trial' | 'cancelled';
  trialEndsAt?: string;
  createdAt: string;
}

const STORAGE_KEY = 'atlas_mock_auth_user';
const USERS_KEY = 'atlas_mock_users';

// Mock user database in localStorage
const getMockUsers = (): Record<string, { email: string; password: string; user: User }> => {
  const stored = localStorage.getItem(USERS_KEY);
  if (stored) {
    return JSON.parse(stored);
  }
  // Create default demo user
  const defaultUsers = {
    'demo@atlas.com': {
      email: 'demo@atlas.com',
      password: 'demo123',
      user: {
        id: 'demo-user-1',
        email: 'demo@atlas.com',
        name: 'Usuario Demo',
        subscriptionPlan: 'free' as const,
        subscriptionStatus: 'active' as const,
        createdAt: new Date().toISOString()
      }
    }
  };
  localStorage.setItem(USERS_KEY, JSON.stringify(defaultUsers));
  return defaultUsers;
};

const saveMockUsers = (users: Record<string, any>) => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

export const mockAuthService = {
  /**
   * Register a new user
   */
  async register(email: string, password: string, name: string): Promise<User> {
    const users = getMockUsers();
    
    if (users[email]) {
      throw new Error('El email ya está registrado');
    }

    const newUser: User = {
      id: `user-${Date.now()}`,
      email,
      name,
      subscriptionPlan: 'free',
      subscriptionStatus: 'trial',
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days trial
      createdAt: new Date().toISOString()
    };

    users[email] = {
      email,
      password, // En producción NUNCA almacenar passwords en texto plano!
      user: newUser
    };

    saveMockUsers(users);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));

    return newUser;
  },

  /**
   * Login with email and password
   */
  async login(email: string, password: string): Promise<User> {
    const users = getMockUsers();
    const userRecord = users[email];

    if (!userRecord || userRecord.password !== password) {
      throw new Error('Email o contraseña incorrectos');
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(userRecord.user));
    return userRecord.user;
  },

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    localStorage.removeItem(STORAGE_KEY);
  },

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  },

  /**
   * Update user profile
   */
  async updateProfile(updates: Partial<User>): Promise<User> {
    const currentUser = this.getCurrentUser();
    if (!currentUser) {
      throw new Error('No hay usuario autenticado');
    }

    const updatedUser = { ...currentUser, ...updates };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));

    // Update in users database
    const users = getMockUsers();
    if (users[currentUser.email]) {
      users[currentUser.email].user = updatedUser;
      saveMockUsers(users);
    }

    return updatedUser;
  },

  /**
   * Update subscription plan
   */
  async updateSubscription(plan: 'free' | 'starter' | 'professional'): Promise<User> {
    return this.updateProfile({
      subscriptionPlan: plan,
      subscriptionStatus: 'active',
      trialEndsAt: undefined
    });
  },

  /**
   * Cancel subscription (downgrade to free)
   */
  async cancelSubscription(): Promise<User> {
    return this.updateProfile({
      subscriptionPlan: 'free',
      subscriptionStatus: 'cancelled'
    });
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.getCurrentUser() !== null;
  }
};
