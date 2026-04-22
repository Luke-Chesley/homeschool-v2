import { redirect } from "next/navigation";

export const metadata = {
  title: "Assistant",
};

export default function CopilotRedirectPage() {
  redirect("/assistant");
}
