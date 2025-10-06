/**
 * PROTOTIPO - Login Page
 * Para pruebas personales
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (error) {
      // Error is handled by AuthContext with toast
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-atlas-navy-1 to-atlas-blue flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-atlas-navy-1">ATLAS</h1>
          <p className="text-neutral-600 mt-2">Horizon & Pulse</p>
        </div>

        {/* Alert - Demo mode */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-amber-800">
            <strong>🧪 MODO PROTOTIPO</strong><br />
            Usuario demo: <code className="bg-amber-100 px-2 py-1 rounded">demo@atlas.com</code><br />
            Contraseña: <code className="bg-amber-100 px-2 py-1 rounded">demo123</code>
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-neutral-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-atlas-blue focus:border-transparent"
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-neutral-700 mb-1">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-atlas-blue focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-atlas-blue text-white py-3 rounded-lg font-medium hover:bg-opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>

        {/* Register Link */}
        <div className="mt-6 text-center">
          <p className="text-sm text-neutral-600">
            ¿No tienes cuenta?{' '}
            <Link to="/register" className="text-atlas-blue font-medium hover:underline">
              Regístrate gratis
            </Link>
          </p>
        </div>

        {/* Info */}
        <div className="mt-8 pt-6 border-t border-neutral-200">
          <p className="text-xs text-neutral-500 text-center">
            Este es un prototipo para pruebas personales.<br />
            Los datos se almacenan localmente en tu navegador.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
