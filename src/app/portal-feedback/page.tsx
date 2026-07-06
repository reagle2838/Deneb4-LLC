import { redirect } from "next/navigation";

// Messages now live inside the portal itself. This route stays alive for
// old bookmarks and links baked into staging sites.
export default function PortalFeedbackPage() {
  redirect("/portal#messages");
}
