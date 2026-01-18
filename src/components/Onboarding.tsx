import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AlertTriangle, Bell, Calendar, MessageCircle, ChevronRight, ChevronLeft, Check } from 'lucide-react';

interface OnboardingProps {
  open: boolean;
  onComplete: () => void;
}

const steps = [
  {
    icon: AlertTriangle,
    title: "Bienvenue sur MEDICBIKE",
    description: "Gérez les interventions médicales d'urgence avec efficacité. Cette application vous permet de recevoir et répondre aux alertes en temps réel.",
    color: "text-red-500"
  },
  {
    icon: Bell,
    title: "Notifications Push",
    description: "Activez les notifications pour être alerté instantanément des nouvelles interventions. Ne manquez jamais une urgence !",
    color: "text-amber-500"
  },
  {
    icon: Calendar,
    title: "Gérez vos disponibilités",
    description: "Indiquez vos créneaux de disponibilité pour que les coordinateurs sachent quand vous êtes opérationnel.",
    color: "text-blue-500"
  },
  {
    icon: MessageCircle,
    title: "Communication en équipe",
    description: "Utilisez le chat pour coordonner les interventions avec votre équipe et le chat général pour les discussions.",
    color: "text-green-500"
  }
];

const Onboarding = ({ open, onComplete }: OnboardingProps) => {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const CurrentIcon = steps[currentStep].icon;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden" onPointerDownOutside={(e) => e.preventDefault()}>
        <div className="relative">
          {/* Progress bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-muted">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>

          {/* Content */}
          <div className="p-8 pt-10">
            <div className="flex flex-col items-center text-center space-y-6">
              {/* Icon */}
              <div className={`w-20 h-20 rounded-full bg-muted flex items-center justify-center ${steps[currentStep].color}`}>
                <CurrentIcon className="w-10 h-10" />
              </div>

              {/* Title */}
              <h2 className="text-2xl font-bold text-foreground">
                {steps[currentStep].title}
              </h2>

              {/* Description */}
              <p className="text-muted-foreground leading-relaxed">
                {steps[currentStep].description}
              </p>

              {/* Step indicators */}
              <div className="flex gap-2">
                {steps.map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === currentStep ? 'bg-primary' : 'bg-muted'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center mt-8">
              {currentStep > 0 ? (
                <Button variant="ghost" onClick={handlePrev}>
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Précédent
                </Button>
              ) : (
                <Button variant="ghost" onClick={handleSkip}>
                  Passer
                </Button>
              )}

              <Button onClick={handleNext}>
                {currentStep < steps.length - 1 ? (
                  <>
                    Suivant
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </>
                ) : (
                  <>
                    Commencer
                    <Check className="w-4 h-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default Onboarding;
