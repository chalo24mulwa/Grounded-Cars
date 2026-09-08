import { siteConfig } from "@/config/site";

// Fixed floating action button, bottom-right, on every page (mounted once
// in the root layout). Deliberately plain <a> to wa.me — no client-side JS
// needed for this. z-50 keeps it above page content but Tailwind's default
// scale still lets a future modal/dialog use a higher z-index if needed.
export function WhatsAppButton() {
  return (
    <a
      href={`https://wa.me/${siteConfig.whatsappNumber}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition hover:scale-105 hover:bg-[#20BD5A] active:scale-95"
    >
      <svg viewBox="0 0 32 32" width="30" height="30" fill="currentColor" aria-hidden="true">
        <path d="M16.02 3C9.4 3 4 8.36 4 14.94c0 2.2.6 4.26 1.65 6.04L4 29l8.24-2.18a12.9 12.9 0 0 0 3.78.57h.01c6.62 0 12.02-5.36 12.02-11.94C28.05 8.36 22.65 3 16.02 3zm0 21.8h-.01a10.1 10.1 0 0 1-5.14-1.41l-.37-.22-3.89 1.03 1.04-3.78-.24-.39a9.83 9.83 0 0 1-1.5-5.09c0-5.46 4.47-9.9 9.98-9.9 5.5 0 9.97 4.44 9.97 9.9 0 5.46-4.47 9.9-9.99 9.9zm5.47-7.41c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.47a8.97 8.97 0 0 1-1.66-2.06c-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.87 1.22 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.22 1.35.19 1.86.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.35z" />
      </svg>
    </a>
  );
}
