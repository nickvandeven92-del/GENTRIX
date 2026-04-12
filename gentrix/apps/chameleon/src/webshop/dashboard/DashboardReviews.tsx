import { useWebshop } from '@/webshop';
import { StarRating } from '../components/StarRating';
import { Button } from '@/components/ui/button';
import { Check, Trash2 } from 'lucide-react';

export default function DashboardReviews() {
  const { state, approveReview, deleteReview } = useWebshop();

  const pending = state.reviews.filter(r => !r.approved);
  const approved = state.reviews.filter(r => r.approved);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Beoordelingen</h1>
        <p className="text-muted-foreground">{state.reviews.length} totaal · {pending.length} wachtend op goedkeuring</p>
      </div>

      {pending.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Wachtend op goedkeuring</h2>
          {pending.map(review => {
            const product = state.products.find(p => p.id === review.productId);
            return (
              <div key={review.id} className="border border-border rounded-lg p-4 bg-card space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <StarRating rating={review.rating} size="sm" />
                    <span className="text-sm font-medium text-card-foreground">{review.author}</span>
                    <span className="text-xs text-muted-foreground">voor {product?.name || 'Onbekend product'}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => approveReview(review.id)}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteReview(review.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <h4 className="font-medium text-card-foreground">{review.title}</h4>
                <p className="text-sm text-muted-foreground">{review.body}</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Goedgekeurde beoordelingen</h2>
        {approved.length === 0 ? (
          <p className="text-muted-foreground py-4">Nog geen goedgekeurde beoordelingen.</p>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-muted-foreground">Product</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Score</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Auteur</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Titel</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Datum</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Acties</th>
                </tr>
              </thead>
              <tbody>
                {approved.map(review => {
                  const product = state.products.find(p => p.id === review.productId);
                  return (
                    <tr key={review.id} className="border-t border-border">
                      <td className="p-3 text-foreground">{product?.name || '—'}</td>
                      <td className="p-3"><StarRating rating={review.rating} size="sm" /></td>
                      <td className="p-3 text-muted-foreground">{review.author}</td>
                      <td className="p-3 text-muted-foreground">{review.title}</td>
                      <td className="p-3 text-muted-foreground">{new Date(review.createdAt).toLocaleDateString('nl-NL')}</td>
                      <td className="p-3 text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteReview(review.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
