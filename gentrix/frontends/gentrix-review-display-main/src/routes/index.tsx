import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ReviewStrip,
  ReviewsConnectionPanel,
  type ReviewsConnection,
  type Review,
} from "@/components/ReviewStrip";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "GENTRIX • ReviewStrip" },
      { name: "description", content: "Embeddable review strip component for GENTRIX." },
    ],
  }),
});

const sampleReviews: Review[] = [
  {
    id: "1",
    authorName: "Sarah Mitchell",
    rating: 5,
    text: "Absolutely loved the experience. The team was attentive, the product quality was outstanding, and delivery was faster than expected. Will definitely order again.",
    date: "2 weeks ago",
    platform: "google",
  },
  {
    id: "2",
    authorName: "James O'Connor",
    rating: 5,
    text: "Fantastic service from start to finish. Highly recommend to anyone looking for a reliable provider.",
    date: "1 month ago",
    platform: "trustpilot",
  },
  {
    id: "3",
    authorName: "Priya Sharma",
    rating: 4,
    text: "Great quality and good communication. Minor delay on shipping but support was helpful and kept me updated throughout.",
    date: "3 weeks ago",
    platform: "google",
  },
  {
    id: "4",
    authorName: "Marco Bianchi",
    rating: 5,
    text: "Honestly the best in this category. Clean, professional, and the result exceeded my expectations.",
    date: "5 days ago",
    platform: "trustpilot",
  },
  {
    id: "5",
    authorName: "Emily Tran",
    rating: 5,
    text: "Smooth process, beautiful packaging, and amazing attention to detail. Already recommended to friends.",
    date: "1 week ago",
    platform: "google",
  },
  {
    id: "6",
    authorName: "David Kim",
    rating: 4,
    text: "Solid experience overall. Good value for the price and the quality is consistent.",
    date: "2 months ago",
    platform: "trustpilot",
  },
];

const googleLiveReviews: Review[] = [
  {
    id: "g-live-1",
    authorName: "Noah van Dijk",
    rating: 5,
    text: "Heel vlotte service en duidelijke communicatie. Binnen een dag reactie op mijn vragen en perfect afgehandeld.",
    date: "2 days ago",
    platform: "google",
  },
  {
    id: "g-live-2",
    authorName: "Mila de Boer",
    rating: 5,
    text: "Super tevreden. Product exact zoals verwacht en levering was sneller dan aangegeven.",
    date: "6 days ago",
    platform: "google",
  },
  {
    id: "g-live-3",
    authorName: "Ravi Patel",
    rating: 4,
    text: "Goede kwaliteit en nette support. Kleine vertraging, maar wel netjes opgelost.",
    date: "1 week ago",
    platform: "google",
  },
  {
    id: "g-live-4",
    authorName: "Sophie Janssen",
    rating: 5,
    text: "Heel betrouwbaar bedrijf. Proces was strak en de kwaliteit is top.",
    date: "10 days ago",
    platform: "google",
  },
];

const trustpilotLiveReviews: Review[] = [
  {
    id: "tp-live-1",
    authorName: "Lars Meijer",
    rating: 5,
    text: "Professioneel team en uitstekende opvolging. Zeker een aanrader.",
    date: "3 days ago",
    platform: "trustpilot",
  },
  {
    id: "tp-live-2",
    authorName: "Ava Bakker",
    rating: 5,
    text: "Alles was transparant en netjes geregeld. Geen verrassingen achteraf.",
    date: "5 days ago",
    platform: "trustpilot",
  },
  {
    id: "tp-live-3",
    authorName: "Youssef El Idrissi",
    rating: 4,
    text: "Prima ervaring. Correcte levering en goede nazorg.",
    date: "1 week ago",
    platform: "trustpilot",
  },
  {
    id: "tp-live-4",
    authorName: "Emma Visser",
    rating: 5,
    text: "Precies gekregen wat beloofd werd. Kwaliteit en communicatie allebei sterk.",
    date: "2 weeks ago",
    platform: "trustpilot",
  },
];

function Index() {
  const [connection, setConnection] = useState<ReviewsConnection | null>(null);
  const [liveCache, setLiveCache] = useState<Review[]>([]);

  const activeReviews = useMemo(() => {
    if (liveCache.length > 0) return liveCache;
    return sampleReviews;
  }, [liveCache]);

  const sourceLabel = liveCache.length > 0 ? "Geverifieerde reviews (live bron)" : "Voorbeeldreviews (tijdelijk)";

  return (
    <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 40 }}>
      <section>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: "#6b7280", margin: "0 0 12px" }}>
          Embedded on client site — strip layout
        </h2>
        <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 10px" }}>{sourceLabel}</p>
        <ReviewStrip reviews={activeReviews} maxReviews={4} layout="strip" />
      </section>

      <section>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: "#6b7280", margin: "0 0 12px" }}>
          Embedded on client site — grid layout
        </h2>
        <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 10px" }}>{sourceLabel}</p>
        <ReviewStrip
          reviews={activeReviews}
          maxReviews={6}
          layout="grid"
          accentColor="#0EA5E9"
          borderRadius="16px"
        />
      </section>

      <section>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: "#6b7280", margin: "0 0 12px" }}>
          Loading state
        </h2>
        <ReviewStrip reviews={[]} maxReviews={4} loading />
      </section>

      <section>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: "#6b7280", margin: "0 0 12px" }}>
          GENTRIX dashboard — reviews connection (dashboard only)
        </h2>
        <ReviewsConnectionPanel
          initialConnection={connection}
          onConnect={(nextConnection) => {
            setConnection(nextConnection);
            const nextLiveReviews =
              nextConnection.platform === "google" ? googleLiveReviews : trustpilotLiveReviews;
            setLiveCache(nextLiveReviews);
          }}
          onDisconnect={() => {
            setConnection(null);
            setLiveCache([]);
          }}
        />
      </section>
    </div>
  );
}
