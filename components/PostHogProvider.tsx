"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { PostHogProvider, usePostHog } from "posthog-js/react";
import { useAuth, useUser } from "@clerk/nextjs";

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthogClient = usePostHog();
  const { isSignedIn, userId } = useAuth();
  const { user } = useUser();

  // Track page views on route change
  useEffect(() => {
    if (!posthogClient || !pathname) return;
    let url = window.origin + pathname;
    if (searchParams?.toString()) {
      url = url + "?" + searchParams.toString();
    }
    posthogClient.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams, posthogClient]);

  // Identify user with Clerk data
  useEffect(() => {
    if (!posthogClient) return;

    if (isSignedIn && userId && user) {
      posthogClient.identify(userId, {
        email: user.primaryEmailAddress?.emailAddress,
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        role: (user.publicMetadata as any)?.role || "student",
      });
    }

    if (!isSignedIn && posthogClient._isIdentified()) {
      posthogClient.reset();
    }
  }, [posthogClient, isSignedIn, userId, user]);

  return null;
}

export default function PHProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;

    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      capture_pageview: false,
      capture_pageleave: true,
      autocapture: true,
    });
  }, []);

  return (
    <PostHogProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PostHogProvider>
  );
}
