import { getPredictionPageData } from "@/lib/services/psx-prediction";
import { PredictionBoard } from "@/components/analysis/prediction-board";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Next Day Prediction | Stockli",
  description: "PSX next-session outlook from live technicals, foreign flows, global macro and news sentiment",
};

export default async function PredictionPage() {
  const data = await getPredictionPageData();
  return <PredictionBoard data={data} />;
}
