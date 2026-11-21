import type { EventFormValues } from "@/components/organizer/event-form";
import { toDateInput } from "@/components/ui";
import type { Event } from "@/generated/prisma/client";

/** The setup forms' values for an event. */
export function eventFormValues(event: Event): EventFormValues {
  return {
    name: event.name, tagline: event.tagline, description: event.description, format: event.format, onlinePlatform: event.onlinePlatform,
    location: event.location, venue: event.venue, address: event.address, latitude: event.latitude, longitude: event.longitude,
    website: event.website, coverImage: event.coverImage, coverFit: event.coverFit as "cover" | "contain", coverPosition: event.coverPosition as "top" | "center" | "bottom",
    startDate: toDateInput(event.startDate), endDate: toDateInput(event.endDate),
    cfpOpensAt: toDateInput(event.cfpOpensAt), cfpClosesAt: toDateInput(event.cfpClosesAt), cfpGuidelines: event.cfpGuidelines,
    tracks: event.tracks, formats: event.formats, titleLimit: event.titleLimit?.toString() ?? "", abstractLimit: event.abstractLimit?.toString() ?? "",
    maxProposalsPerSpeaker: event.maxProposalsPerSpeaker, blindReview: event.blindReview,
    confirmationEmailEnabled: event.confirmationEmailEnabled, confirmationEmailSubject: event.confirmationEmailSubject, confirmationEmailBody: event.confirmationEmailBody,
  };
}
