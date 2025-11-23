// frontend/app/profile/page.tsx
import { fetchUserProfile } from "@/lib/serverApi";
import { ProfileClient } from "@/components/ProfileClient";

export default async function ProfilePage() {
  const profile = await fetchUserProfile();

  return <ProfileClient initialProfile={profile} />;
}
