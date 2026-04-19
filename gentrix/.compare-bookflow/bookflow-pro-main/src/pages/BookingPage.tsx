import { BookingFlow } from '@/components/booking/BookingFlow';
import { useBusiness } from '@/context/BusinessContext';

export default function BookingPage() {
  const { business } = useBusiness();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-md">
        <div className="container flex items-center justify-between h-14">
          <span className="font-heading font-bold text-lg">{business.name}</span>
        </div>
      </header>
      <main className="container py-10">
        <BookingFlow />
      </main>
    </div>
  );
}
