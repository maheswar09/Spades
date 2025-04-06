import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home as HomeIcon, FileAudio, BarChart2 } from 'lucide-react';

const Navbar = () => {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <nav className="bg-black/30 backdrop-blur-lg border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <FileAudio className="h-12 w-12 text-purple-400" />
              <span className="text-white font-bold text-4xl">MeetingAI</span>
            </Link>
          </div>
          <div className="flex space-x-4">
            <Link
              to="/"
              className={`px-3 py-2 rounded-md text-xl font-medium transition-colors duration-200 ease-in-out ${
                isActive('/') 
                  ? 'bg-purple-500 text-white' 
                  : 'text-gray-300 hover:bg-purple-500/50 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-2">
                <HomeIcon className="h-8 w-8" />
                <span>Home</span>
              </div>
            </Link>
            <Link
              to="/dashboard"
              className={`px-3 py-2 rounded-md text-xl font-medium transition-colors duration-200 ease-in-out ${
                isActive('/dashboard')
                  ? 'bg-purple-500 text-white'
                  : 'text-gray-300 hover:bg-purple-500/50 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-2">
                <FileAudio className="h-8 w-8" />
                <span>Live</span>
              </div>
            </Link>
            <Link
              to="/dashboard1"
              className={`px-3 py-2 rounded-md text-xl font-medium transition-colors duration-200 ease-in-out ${
                isActive('/dashboard1')
                  ? 'bg-purple-500 text-white'
                  : 'text-gray-300 hover:bg-purple-500/50 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-2">
                <BarChart2 className="h-8 w-8" />
                <span>Analysis</span>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;