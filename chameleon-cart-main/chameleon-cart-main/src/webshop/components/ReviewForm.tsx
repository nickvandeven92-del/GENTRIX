import { useState } from 'react';
import { toast } from 'sonner';
import { useWebshop } from '../context/WebshopContext';
import { StarRating } from './StarRating';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface ReviewFormProps {
  productId: string;
}

export function ReviewForm({ productId }: ReviewFormProps) {
  const { addReview } = useWebshop();
  const [submitted, setSubmitted] = useState(false);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [author, setAuthor] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) return;
    try {
      await addReview({
        id: `rev-${Date.now()}`,
        productId,
        author,
        email,
        rating,
        title,
        body,
        verified: false,
        approved: false,
        createdAt: new Date().toISOString(),
      });
      setSubmitted(true);
    } catch {
      toast.error('Beoordeling versturen mislukt');
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-6 border border-border rounded-lg bg-card">
        <p className="text-foreground font-medium">Bedankt voor je beoordeling!</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="border border-border rounded-lg p-6 space-y-4 bg-card">
      <h3 className="font-semibold text-card-foreground">Schrijf een beoordeling</h3>

      <div>
        <Label className="mb-2 block">Beoordeling</Label>
        <StarRating rating={rating} size="lg" interactive onChange={setRating} />
        {rating === 0 && <p className="text-xs text-muted-foreground mt-1">Selecteer een score</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="rev-author">Naam</Label>
          <Input id="rev-author" required value={author} onChange={e => setAuthor(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="rev-email">E-mail</Label>
          <Input id="rev-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
        </div>
      </div>

      <div>
        <Label htmlFor="rev-title">Titel</Label>
        <Input id="rev-title" required value={title} onChange={e => setTitle(e.target.value)} />
      </div>

      <div>
        <Label htmlFor="rev-body">Je beoordeling</Label>
        <Textarea id="rev-body" required rows={3} value={body} onChange={e => setBody(e.target.value)} />
      </div>

      <Button type="submit" disabled={rating === 0}>
        Beoordeling plaatsen
      </Button>
    </form>
  );
}
