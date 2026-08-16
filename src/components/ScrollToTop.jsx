import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

const ScrollToTop = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const height = document.documentElement.scrollHeight - window.innerHeight;
      const progress = height > 0 ? (scrollY / height) * 100 : 0;
      
      setScrollProgress(progress);
      
      if (scrollY > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    <>
      {isVisible && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 z-50 group"
          aria-label="Scroll to top"
        >
          <div className="relative w-14 h-14">
            {/* Progress Circle */}
            <svg className="w-14 h-14 -rotate-90" viewBox="0 0 60 60">
              <circle
                cx="30"
                cy="30"
                r="26"
                fill="none"
                stroke="#1f2937"
                strokeWidth="3"
                className="dark:stroke-gray-700"
              />
              <circle
                cx="30"
                cy="30"
                r="26"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="3"
                strokeDasharray={`${(scrollProgress / 100) * 163.36} 163.36`}
                strokeLinecap="round"
                className="transition-all duration-300"
              />
            </svg>

            {/* Button with Blue Gradient */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 hover:from-blue-600 hover:via-blue-700 hover:to-blue-800 transition-all duration-300 flex items-center justify-center shadow-lg hover:shadow-blue-500/30 hover:shadow-xl hover:scale-110">
                <ArrowUp className="w-6 h-6 text-white font-bold" />
              </div>
            </div>
          </div>
        </button>
      )}
    </>
  );
};

export default ScrollToTop;