import { trackError } from "./services/analytics";

App({
  onError(message: string) {
    trackError(message);
  },
  onUnhandledRejection(event: { reason?: unknown }) {
    trackError(event?.reason ?? "unhandled rejection");
  },
});
