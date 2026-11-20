// Client-safe catalogs of things people can ask for. Stored by id, so labels can change freely.

export type RequirementGroup = { group: string; items: { id: string; label: string }[] };

/** What a speaker needs to deliver their session. */
export const PRESENTATION_REQUIREMENTS: RequirementGroup[] = [
  {
    group: "Display",
    items: [
      { id: "projector_hdmi", label: "Projector / screen (HDMI)" },
      { id: "usb_c_adapter", label: "USB-C display adapter" },
      { id: "confidence_monitor", label: "Confidence monitor facing the stage" },
      { id: "venue_laptop", label: "Venue laptop (not bringing my own)" },
    ],
  },
  {
    group: "Audio",
    items: [
      { id: "lapel_mic", label: "Lapel or headset microphone" },
      { id: "handheld_mic", label: "Handheld microphone" },
      { id: "laptop_audio", label: "Laptop audio to the PA" },
      { id: "extra_mics", label: "Extra mics for co-speakers" },
    ],
  },
  {
    group: "Stage & tools",
    items: [
      { id: "clicker", label: "Presentation clicker" },
      { id: "lectern", label: "Lectern" },
      { id: "stage_power", label: "Power on stage" },
      { id: "demo_table", label: "Table for a hardware demo" },
      { id: "whiteboard", label: "Whiteboard or flipchart" },
    ],
  },
  {
    group: "Connectivity",
    items: [
      { id: "wired_internet", label: "Wired internet for a live demo" },
      { id: "dedicated_wifi", label: "Dedicated Wi-Fi network" },
    ],
  },
  {
    group: "Workshops",
    items: [
      { id: "attendee_power", label: "Power sockets for attendees" },
      { id: "attendee_wifi", label: "Wi-Fi for all attendees" },
      { id: "classroom_seating", label: "Classroom seating with tables" },
    ],
  },
  {
    // No disability-related items: those are health data (GDPR Art. 9) and aren't needed to plan a session.
    group: "Captioning & recording",
    items: [
      { id: "captioning", label: "Live captioning or sign language" },
      { id: "no_recording", label: "Please don't record this session" },
    ],
  },
];

/** What a sponsor needs on site and around the event. */
export const SPONSOR_REQUIREMENTS: RequirementGroup[] = [
  {
    group: "Booth",
    items: [
      { id: "booth_3x3", label: "Booth space 3 × 3 m" },
      { id: "booth_6x3", label: "Booth space 6 × 3 m" },
      { id: "table_chairs", label: "Table and chairs" },
      { id: "booth_power", label: "Power at the booth" },
      { id: "booth_network", label: "Wired network / Wi-Fi at the booth" },
      { id: "booth_screen", label: "Display screen at the booth" },
    ],
  },
  {
    group: "Visibility",
    items: [
      { id: "sponsored_talk", label: "A sponsored talk slot" },
      { id: "keynote_mention", label: "Mention during the opening keynote" },
      { id: "swag_bag", label: "Swag in the attendee bag" },
      { id: "newsletter", label: "Feature in the attendee newsletter" },
      { id: "social_posts", label: "Social media announcement" },
    ],
  },
  {
    group: "Leads & people",
    items: [
      { id: "lead_scanning", label: "Lead scanning app" },
      { id: "staff_passes", label: "Extra staff passes" },
      { id: "staff_catering", label: "Catering for booth staff" },
    ],
  },
  {
    group: "Logistics",
    items: [
      { id: "loading_access", label: "Loading dock / parking access" },
      { id: "shipping_storage", label: "Shipping address and storage" },
      { id: "early_setup", label: "Setup the evening before" },
    ],
  },
];

const index = (groups: RequirementGroup[]) => new Map(groups.flatMap((g) => g.items.map((i) => [i.id, i.label] as const)));
const PRESENTATION_INDEX = index(PRESENTATION_REQUIREMENTS);
const SPONSOR_INDEX = index(SPONSOR_REQUIREMENTS);

export const presentationLabel = (id: string) => PRESENTATION_INDEX.get(id) ?? id;
export const sponsorRequirementLabel = (id: string) => SPONSOR_INDEX.get(id) ?? id;
export const isPresentationRequirement = (id: string) => PRESENTATION_INDEX.has(id);
export const isSponsorRequirement = (id: string) => SPONSOR_INDEX.has(id);
