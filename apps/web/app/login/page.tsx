import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { currentUser } from "@/lib/session";

export default async function Page() {
  if (await currentUser()) redirect("/articles");
  return (
    <main className="auth">
      <h1>InstaFeed</h1>
      <AuthForm mode="login" />
    </main>
  );
}
