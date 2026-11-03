import { MissionDesk } from "@/components/mission-desk";

const SAMPLE_DEADLINE = "2026-12-15T17:00";

export default function HomePage() {
  return <MissionDesk initialDeadline={SAMPLE_DEADLINE} />;
}
