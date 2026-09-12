import React from 'react';
import { Search } from 'lucide-react';

interface FloatingAddButtonProps {
  onClick: () => void;
  isVisible?: boolean;
}

export const FloatingAddButton: React.FC<FloatingAddButtonProps> = ({
  onClick,
  isVisible = true
}) => {
  if (!isVisible) return null;

  return (
    <button
      type="button"
      className="fab-find-add"
      onClick={onClick}
      title="Find & Add Media"
      aria-label="Find & Add Media"
    >
      <Search size={22} color="#ffffff" strokeWidth={2.4} />
    </button>
  );
};
