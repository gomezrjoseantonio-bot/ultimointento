import React from 'react';
import { categoryToIcon } from '../utils/categoryToIcon';

interface CategoryIconProps {
  category: string | undefined | null;
  size?: number;
}

const CategoryIcon: React.FC<CategoryIconProps> = ({ category, size = 14 }) => {
  const Icon = categoryToIcon(category);
  return (
    <span className="cv2-cat-icon" aria-hidden>
      <Icon size={size} />
    </span>
  );
};

export default CategoryIcon;
