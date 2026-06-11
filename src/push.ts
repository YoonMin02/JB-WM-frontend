import * as api from "./api";

export async function enablePushNotifications(): Promise<"enabled" | "unsupported" | "denied"> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return "unsupported";
  }
  if (!window.isSecureContext) return "unsupported";

  const permission =
    Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  if (permission !== "granted") return "denied";

  const registration = await navigator.serviceWorker.register("/sw.js");
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array((await api.getPushPublicKey()).public_key),
    }));

  await api.registerPushSubscription(subscription.toJSON());
  return "enabled";
}

export function registerPwaShell() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("PWA service worker registration failed", error);
    });
  });
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
