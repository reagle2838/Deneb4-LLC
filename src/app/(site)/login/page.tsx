import type { Metadata } from "next";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Client Login",
  description: "Log in to the Deneb4 client portal.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return <LoginForm />;
}
