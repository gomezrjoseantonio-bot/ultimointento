import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Star,
  Building,
  FileText,
  BarChart3,
  Settings,
  X,
} from 'lucide-react';

interface FavoriteItem {
  id: string;
  type: 'page' | 'property' | 'document' | 'feature';
  title: string;
  subtitle?: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STORAGE_KEY = 'atlas_favorites';

// Type for serialized favorite item (without icon function)
interface SerializedFavoriteItem {
  id: string;
  type: 'page' | 'property' | 'document' | 'feature';
  title: string;
  subtitle?: string;
  path: string;
}

/**
 * Service to manage favorite items
 */
export class FavoritesService {
  static getFavorites(): FavoriteItem[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      
      const items: SerializedFavoriteItem[] = JSON.parse(stored);
      
      // Restore icon functions
      return items.map((item) => ({
        ...item,
        icon: this.getIconForType(item.type),
      }));
    } catch (error) {
      console.error('Failed to load favorites:', error);
      return [];
    }
  }
  
  static addFavorite(item: Omit<FavoriteItem, 'icon'>) {
    const favorites = this.getFavorites();
    
    // Check if already favorited
    if (favorites.some(fav => fav.id === item.id)) {
      return;
    }
    
    // Add icon based on type
    const icon = this.getIconForType(item.type);
    
    const newFavorite: FavoriteItem = {
      ...item,
      icon,
    };
    
    const updated = [...favorites, newFavorite];
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save favorite:', error);
    }
  }
  
  static removeFavorite(id: string) {
    const favorites = this.getFavorites();
    const updated = favorites.filter(fav => fav.id !== id);
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to remove favorite:', error);
    }
  }
  
  static isFavorite(id: string): boolean {
    const favorites = this.getFavorites();
    return favorites.some(fav => fav.id === id);
  }
  
  static toggleFavorite(item: Omit<FavoriteItem, 'icon'>) {
    if (this.isFavorite(item.id)) {
      this.removeFavorite(item.id);
    } else {
      this.addFavorite(item);
    }
  }
  
  private static getIconForType(type: string) {
    switch (type) {
      case 'property':
        return Building;
      case 'document':
        return FileText;
      case 'feature':
        return BarChart3;
      default:
        return Settings;
    }
  }
}

/**
 * Favorite Button Component - to be used in pages/items
 */
interface FavoriteButtonProps {
  item: Omit<FavoriteItem, 'icon'>;
  className?: string;
}

export const FavoriteButton: React.FC<FavoriteButtonProps> = ({ item, className = '' }) => {
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    setIsFavorite(FavoritesService.isFavorite(item.id));
  }, [item.id]);

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    FavoritesService.toggleFavorite(item);
    setIsFavorite(!isFavorite);
  };

  return (
    <button
      onClick={handleToggle}
      className={`p-2 rounded-lg transition-colors ${
        isFavorite
          ? 'text-yellow-500 hover:text-warning-600 bg-warning-50 hover:bg-warning-100'
          : 'text-gray-400 hover:text-yellow-500 hover:bg-warning-50'
      } ${className}`}
      aria-label={isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
      title={isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
    >
      <Star className="w-5 h-5" fill={isFavorite ? "currentColor" : "none"} />
    </button>
  );
};

/**
 * Favorites Widget Component for Dashboard
 */
const FavoritesWidget: React.FC = () => {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    // Load favorites on mount
    const items = FavoritesService.getFavorites();
    setFavorites(items);

    // Listen for storage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        const items = FavoritesService.getFavorites();
        setFavorites(items);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleItemClick = (item: FavoriteItem) => {
    navigate(item.path);
  };

  const handleRemove = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    FavoritesService.removeFavorite(id);
    setFavorites(FavoritesService.getFavorites());
  };

  if (favorites.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Star className="w-5 h-5 text-yellow-500" fill="currentColor" />
          <h3 className="text-lg font-semibold text-gray-900">
            Favoritos
          </h3>
        </div>
        <div className="text-center py-8 text-gray-500">
          <Star className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-sm">No hay favoritos</p>
          <p className="text-xs mt-1">
            Marca páginas o elementos como favoritos para acceso rápido
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-500" fill="currentColor" />
          <h3 className="text-lg font-semibold text-gray-900">
            Favoritos
          </h3>
          <span className="text-sm text-gray-500">
            ({favorites.length})
          </span>
        </div>
      </div>

      {/* Favorites List */}
      <div className="divide-y divide-gray-100">
        {favorites.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              className="flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors group"
            >
              <button
                onClick={() => handleItemClick(item)}
                className="flex-1 flex items-center gap-3 text-left min-w-0"
              >
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-lg bg-warning-50 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-warning-600" />
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">
                    {item.title}
                  </div>
                  {item.subtitle && (
                    <div className="text-sm text-gray-500 truncate">
                      {item.subtitle}
                    </div>
                  )}
                </div>
              </button>
              
              <button
                onClick={(e) => handleRemove(e, item.id)}
                className="atlas-btn-destructive flex-shrink-0 p-1.5 text-gray-400 opacity-0 group-hover:opacity-100"
                aria-label="Quitar de favoritos"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FavoritesWidget;
