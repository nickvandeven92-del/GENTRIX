import { Service } from '@/types';
import { Card } from '@/components/ui/card';
import { Clock } from 'lucide-react';

interface Props {
  services: Service[];
  onSelect: (service: Service) => void;
}

export function ServiceSelect({ services, onSelect }: Props) {
  return (
    <div>
      <h2 className="text-2xl font-heading font-bold mb-2">Kies een dienst</h2>
      <p className="text-muted-foreground mb-6">Selecteer de dienst waarvoor je een afspraak wilt maken.</p>
      <div className="grid gap-3">
        {services.map(service => (
          <Card
            key={service.id}
            className="p-4 cursor-pointer hover:shadow-md transition-all hover:border-primary/40 group"
            onClick={() => onSelect(service)}
          >
            <div className="flex items-center gap-4">
              <div className="w-3 h-10 rounded-full" style={{ backgroundColor: service.color }} />
              <div className="flex-1 min-w-0">
                <h3 className="font-heading font-semibold group-hover:text-primary transition-colors">{service.name}</h3>
                <p className="text-sm text-muted-foreground truncate">{service.description}</p>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground shrink-0">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {service.duration} min
                </span>
                {service.price !== null && service.price > 0 && (
                  <span className="font-semibold text-foreground">
                    €{service.price.toFixed(2)}
                  </span>
                )}
                {service.price === 0 && (
                  <span className="text-primary font-medium">Gratis</span>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
