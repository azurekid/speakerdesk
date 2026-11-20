import { redirect } from "next/navigation";

/** Friendly entry point: speakerdesk.app/organizers → organizer sign-in. */
export default function OrganizersEntry() {
  redirect("/sign-in?next=/organize");
}
