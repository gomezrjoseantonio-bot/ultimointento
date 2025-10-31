import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  Building,
  FileText,
  Banknote,
  BarChart3,
} from 'lucide-react';

interface RecentItem {
  id: string;
  type: 'property' | 'document' | 'movement' | 'page';
  title: string;
  subtitle?: string;
  path: string;
  timestamp: number;
  icon: React.ComponentType<{ className?: string }>;
}

const STORAGE_KEY = 'atlas_recent_items';
const MAX_RECENT_ITEMS = 10;

/**
 * Service to track and manage recently viewed items
 */
export class RecentItemsService {
  static addRecentItem(item: Omit<RecentItem, 'timestamp' | 'icon'>) {
    const items = this.getRecentItems();
    
    // Remove duplicate if exists
    const filtered = items.filter(i => i.id !== item.id);
    
    // Add icon based on type
    let icon: RecentItem['icon'];
    switch (item.type) {
      case 'property':
        icon = Building;
        break;
      case 'document':
        icon = FileText;
        break;
      case 'movement':
        icon = Banknote;
        break;
      default:
        icon = BarChart3;
    }
    
    // Add new item at the beginning
    const newItem: RecentItem = {
      ...item,
      timestamp: Date.now(),
      icon,
    };
    
    const updated = [newItem, ...filtered].slice(0, MAX_RECENT_ITEMS);
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save recent items - storage may be full. Consider clearing browser data or recent items.', error);
    }
  }
  
  static getRecentItems(): RecentItem[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      
      const items = JSON.parse(stored);
      
      // Restore icon functions
      return items.map((item: any) => ({
        ...item,
        icon: this.getIconForType(item.type),
      }));
    } catch (error) {
      console.error('Failed to load recent items:', error);
      return [];
    }
  }
  
  static clearRecentItems() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear recent items:', error);
    }
  }
  
  private static getIconForType(type: string) {
    switch (type) {
      case 'property':
        return Building;
      case 'document':
        return FileText;
      case 'movement':
        return Banknote;
      default:
        return BarChart3;
    }
  }
}

/**
 * Recent Items Widget Component for Dashboard
 */
const RecentItemsWidget: React.FC = () => {
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    // Load recent items on mount
    const items = RecentItemsService.getRecentItems();
    setRecentItems(items);

    // Listen for storage changes (updates from other tabs)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        const items = RecentItemsService.getRecentItems();
        setRecentItems(items);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const formatTimestamp = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Ahora mismo';
    if (minutes < 60) return `Hace ${minutes}m`;
    if (hours < 24) return `Hace ${hours}h`;
    if (days < 7) return `Hace ${days}d`;
    
    const date = new Date(timestamp);
    return date.toLocaleDateString('es-ES', { 
      day: 'numeric', 
      month: 'short' 
    });
  };

  const handleItemClick = (item: RecentItem) => {
    navigate(item.path);
  };

  const handleClearAll = () => {
    RecentItemsService.clearRecentItems();
    setRecentItems([]);
  };

  if (recentItems.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900">
            Recientes
          </h3>
        </div>
        <div className="text-center py-8 text-gray-500">
          <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-sm">No hay elementos recientes</p>
          <p className="text-xs mt-1">
            Los elementos que visites aparecerán aquí
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
          <Clock className="w-5 h-5 text-atlas-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            Recientes
          </h3>
          <span className="text-sm text-gray-500">
            ({recentItems.length})
          </span>
        </div>
        <button
          onClick={handleClearAll}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          Limpiar todo
        </button>
      </div>

      {/* Recent Items List */}
      <div className="divide-y divide-gray-100">
        {recentItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => handleItemClick(item)}
              className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-lg bg-atlas-blue-50 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-atlas-blue-600" />
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
              
              <div className="flex-shrink-0 text-xs text-gray-400">
                {formatTimestamp(item.timestamp)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default RecentItemsWidget;
