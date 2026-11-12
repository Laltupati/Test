import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface NavbarProps {
  onSearch: (query: string) => void;
  searchQuery: string;
}

const Navbar: React.FC<NavbarProps> = ({ onSearch, searchQuery }) => {
  const { logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [localSearch, setLocalSearch] = useState(searchQuery);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalSearch(value);
    onSearch(value);
  };

  const clearSearch = () => {
    setLocalSearch('');
    onSearch('');
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-md">
              <i className="fa-solid fa-robot"></i>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold text-slate-900 leading-none">QualiVerse AI</h1>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Next-Gen Quality & Agentic Execution</p>
            </div>
          </div>

          {/* Global Search & Controls */}
          <div className="flex items-center space-x-3">
            {/* Search Bar */}
            <div className="relative w-48 sm:w-64">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
              <input
                type="text"
                placeholder="Search projects, tags..."
                value={localSearch}
                onChange={handleSearchChange}
                className="w-full pl-9 pr-4 py-1.5 text-sm bg-slate-100 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
              {localSearch && (
                <button
                  onClick={clearSearch}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  <i className="fa-solid fa-circle-xmark"></i>
                </button>
              )}
            </div>

            {/* Admin Button */}
            {isAdmin && (
              <button
                onClick={() => navigate('/admin')}
                className="flex items-center space-x-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-all"
              >
                <i className="fa-solid fa-shield-halved"></i>
                <span>Admin</span>
              </button>
            )}

            {/* Logout Button */}
            <button
              onClick={logout}
              className="flex items-center space-x-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-all ml-2"
            >
              <i className="fa-solid fa-arrow-right-from-bracket"></i>
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
