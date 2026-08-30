import { Redirect } from "expo-router";

// Purpose: Redirects the legacy Explore route to the Trails screen.
export default function ExploreScreen() {
  return <Redirect href="/trails" />;
}
