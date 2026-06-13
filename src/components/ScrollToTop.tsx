"use client";

import { useEffect, useState } from "react";
import { ChevronUp } from "lucide-react";

export default function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 400) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener("scroll", toggleVisibility);

    return () => {
      window.removeEventListener("scroll", toggleVisibility);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <button
      onClick={scrollToTop}
      aria-label="Scroll to top"
      className={`
        fixed bottom-8 right-8 z-50
        flex items-center justify-center
        w-14 h-14 rounded-full
        bg-linear-to-r from-indigo-500 to-purple-600
        text-white
        shadow-[0_0_25px_rgba(99,102,241,0.45)]
        transition-all duration-300 ease-out
        hover:scale-110
        hover:shadow-[0_0_40px_rgba(99,102,241,0.7)]
        active:scale-95
        ${
          isVisible
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-6 pointer-events-none"
        }
      `}
    >
      <ChevronUp size={26} />
    </button>
  );
}