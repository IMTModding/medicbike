import { useState, useEffect } from 'react';
import logo from '@/assets/logo.jpg';

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen = ({ onFinish }: SplashScreenProps) => {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Start fade out after 1.5 seconds
    const fadeTimer = setTimeout(() => {
      setFadeOut(true);
    }, 1500);

    // Complete transition after 2 seconds
    const finishTimer = setTimeout(() => {
      onFinish();
    }, 2000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(finishTimer);
    };
  }, [onFinish]);

  return (
    <div 
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background transition-opacity duration-500 safe-all ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="flex flex-col items-center gap-6 animate-fade-in px-4">
        <div className="relative">
          <img 
            src={logo} 
            alt="MEDICBIKE Logo" 
            className="w-32 h-32 rounded-full object-cover shadow-2xl animate-pulse"
          />
          <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
        </div>
        
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground tracking-wide">
            MEDICBIKE
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Unité Médicale Motocycliste
          </p>
        </div>

        <div className="flex gap-1 mt-4">
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
};
