import { redirect } from "next/navigation";

/** The role chooser now lives in onboarding. */
export default function WelcomePage() {
  redirect("/onboarding");
}
